


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_service_status_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.status = 'A fazer' then
    new.done_at := null;
    new.delivered_at := null;
  elsif new.status in ('Pronto', 'Feito') then
    new.done_at := coalesce(new.done_at, now());
    new.delivered_at := null;
  elsif new.status = 'Entregue' then
    new.done_at := coalesce(new.done_at, now());
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_service_status_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "previous_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "services_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "payments_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "discounts_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_due" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'Aberta'::"text" NOT NULL,
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "billing_number" integer,
    CONSTRAINT "billings_status_check" CHECK (("status" = ANY (ARRAY['Aberta'::"text", 'Parcial'::"text", 'Paga'::"text", 'Cancelada'::"text"])))
);


ALTER TABLE "public"."billings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_access_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "billing_id" "uuid" NOT NULL,
    "identifier_hash" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_access_at" timestamp with time zone,
    "history_enabled" boolean DEFAULT false NOT NULL,
    "magic_link_hash" "text"
);


ALTER TABLE "public"."client_access_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_requesters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_requesters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_name" "text" NOT NULL,
    "references_list" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "requested_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "requested_by" "text",
    "notes" "text",
    "status" "text" DEFAULT 'Novo'::"text" NOT NULL,
    "imported_entry_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "imported_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_service_requests_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "client_service_requests_status_check" CHECK (("status" = ANY (ARRAY['Novo'::"text", 'Importado'::"text", 'Cancelado'::"text"])))
);


ALTER TABLE "public"."client_service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "price_table_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document" "text",
    "email" "text",
    "contact_name" "text",
    "zip_code" "text",
    "address" "text",
    "address_number" "text",
    "address_complement" "text",
    "neighborhood" "text",
    "city" "text",
    "state" "text",
    "notes" "text",
    "billing_frequency" "text" DEFAULT 'semanal'::"text" NOT NULL,
    CONSTRAINT "clients_billing_frequency_check" CHECK (("billing_frequency" = ANY (ARRAY['semanal'::"text", 'quinzenal'::"text", 'mensal'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "details" "text",
    "payment_link" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "method" "text",
    "notes" "text",
    "billing_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_payment_id" "text",
    "payment_source" "text",
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notified_alerts" (
    "alert_key" "text" NOT NULL,
    "notified_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_notified_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth_key" "text" NOT NULL,
    "device_label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "code" "text"
);


ALTER TABLE "public"."service_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_name" "text" NOT NULL,
    "reference" "text",
    "service_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'A fazer'::"text" NOT NULL,
    "billing_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivery_code" "text",
    "confirmation_requested_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "delivery_source" "text",
    "service_group_id" "uuid",
    "primary_entry_id" "uuid",
    "is_secondary" boolean DEFAULT false NOT NULL,
    "cancellation_reason" "text",
    "cancellation_original_amount" numeric(12,2),
    "done_at" timestamp with time zone,
    "requested_by" "text",
    CONSTRAINT "service_entries_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "service_entries_status_check" CHECK (("status" = ANY (ARRAY['A fazer'::"text", 'Pronto'::"text", 'Entregue'::"text", 'Cancelado'::"text"])))
);


ALTER TABLE "public"."service_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_prices" (
    "service_id" "uuid" NOT NULL,
    "price_table_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_prices_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."service_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_tracking_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_access_at" timestamp with time zone,
    "allow_requests" boolean DEFAULT false NOT NULL,
    "show_amounts" boolean DEFAULT true NOT NULL,
    "identifier_hash" "text",
    "password_hash" "text",
    "full_token_hash" "text",
    "full_show_financial" boolean DEFAULT true NOT NULL,
    "full_show_billing" boolean DEFAULT true NOT NULL,
    "visible_service_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "plain_access_code" "text",
    "plain_full_token" "text",
    "plain_identifier" "text",
    "plain_password" "text",
    CONSTRAINT "service_tracking_links_check" CHECK (("period_end" >= "period_start"))
);


ALTER TABLE "public"."service_tracking_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "supplier_service_id" "uuid",
    "client_id" "uuid",
    "client_service_entry_id" "uuid",
    "payable_id" "uuid",
    "service_date" "date" NOT NULL,
    "service_name" "text" NOT NULL,
    "reference" "text",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'A fazer'::"text" NOT NULL,
    "source" "text" DEFAULT 'Direto'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancellation_reason" "text",
    "cancellation_original_amount" numeric(12,2),
    "last_changed_by" "text",
    "done_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    CONSTRAINT "supplier_entries_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "supplier_entries_last_changed_by_check" CHECK ((("last_changed_by" IS NULL) OR ("last_changed_by" = ANY (ARRAY['Administrador'::"text", 'Fornecedor'::"text"])))),
    CONSTRAINT "supplier_entries_source_check" CHECK (("source" = ANY (ARRAY['Cliente'::"text", 'Direto'::"text", 'Fornecedor'::"text"]))),
    CONSTRAINT "supplier_entries_status_check" CHECK (("status" = ANY (ARRAY['A fazer'::"text", 'Feito'::"text", 'Entregue'::"text", 'Cancelado'::"text"])))
);


ALTER TABLE "public"."supplier_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_payables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "total_due" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'Aberta'::"text" NOT NULL,
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_payables_check" CHECK (("period_end" >= "period_start")),
    CONSTRAINT "supplier_payables_status_check" CHECK (("status" = ANY (ARRAY['Aberta'::"text", 'Parcial'::"text", 'Paga'::"text", 'Cancelada'::"text"]))),
    CONSTRAINT "supplier_payables_total_due_check" CHECK (("total_due" >= (0)::numeric))
);


ALTER TABLE "public"."supplier_payables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "payable_id" "uuid",
    "payment_date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "method" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_source" "text",
    CONSTRAINT "supplier_payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."supplier_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_portal_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_access_at" timestamp with time zone,
    "can_mark_done" boolean DEFAULT false NOT NULL,
    "can_cancel" boolean DEFAULT false NOT NULL,
    "show_linked_notes" boolean DEFAULT false NOT NULL,
    "show_entries" boolean DEFAULT true NOT NULL,
    "identifier_hash" "text",
    "password_hash" "text",
    "plain_access_code" "text",
    "plain_identifier" "text",
    "plain_password" "text",
    CONSTRAINT "supplier_portal_links_check" CHECK (("period_end" >= "period_start"))
);


ALTER TABLE "public"."supplier_portal_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "code" "text",
    "name" "text" NOT NULL,
    "default_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_services_default_cost_check" CHECK (("default_cost" >= (0)::numeric))
);


ALTER TABLE "public"."supplier_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "document" "text",
    "notes" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "whatsapp_destination" "text" DEFAULT 'individual'::"text" NOT NULL,
    "whatsapp_group_name" "text",
    CONSTRAINT "suppliers_whatsapp_destination_check" CHECK (("whatsapp_destination" = ANY (ARRAY['individual'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_sessions" (
    "session" "text" NOT NULL,
    "status" "text" DEFAULT 'starting'::"text" NOT NULL,
    "message" "text",
    "qr_code" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."billings"
    ADD CONSTRAINT "billings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_access_credentials"
    ADD CONSTRAINT "client_access_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_requesters"
    ADD CONSTRAINT "client_requesters_client_id_normalized_name_key" UNIQUE ("client_id", "normalized_name");



ALTER TABLE ONLY "public"."client_requesters"
    ADD CONSTRAINT "client_requesters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_service_requests"
    ADD CONSTRAINT "client_service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_tables"
    ADD CONSTRAINT "price_tables_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."price_tables"
    ADD CONSTRAINT "price_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notified_alerts"
    ADD CONSTRAINT "push_notified_alerts_pkey" PRIMARY KEY ("alert_key");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_entries"
    ADD CONSTRAINT "service_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_prices"
    ADD CONSTRAINT "service_prices_pkey" PRIMARY KEY ("service_id", "price_table_id");



ALTER TABLE ONLY "public"."service_tracking_links"
    ADD CONSTRAINT "service_tracking_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_tracking_links"
    ADD CONSTRAINT "service_tracking_links_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."supplier_entries"
    ADD CONSTRAINT "supplier_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_payables"
    ADD CONSTRAINT "supplier_payables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_portal_links"
    ADD CONSTRAINT "supplier_portal_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_portal_links"
    ADD CONSTRAINT "supplier_portal_links_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."supplier_services"
    ADD CONSTRAINT "supplier_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("session");



CREATE UNIQUE INDEX "billings_billing_number_idx" ON "public"."billings" USING "btree" ("billing_number") WHERE ("billing_number" IS NOT NULL);



CREATE INDEX "billings_client_period_idx" ON "public"."billings" USING "btree" ("client_id", "period_end" DESC);



CREATE UNIQUE INDEX "client_credentials_magic_link_idx" ON "public"."client_access_credentials" USING "btree" ("magic_link_hash") WHERE ("magic_link_hash" IS NOT NULL);



CREATE INDEX "client_service_requests_client_status_idx" ON "public"."client_service_requests" USING "btree" ("client_id", "status", "requested_date" DESC);



CREATE UNIQUE INDEX "one_active_client_credential_idx" ON "public"."client_access_credentials" USING "btree" ("client_id") WHERE "active";



CREATE UNIQUE INDEX "one_default_supplier_idx" ON "public"."suppliers" USING "btree" ("is_default") WHERE ("is_default" AND "active");



CREATE INDEX "payments_client_date_idx" ON "public"."payments" USING "btree" ("client_id", "payment_date");



CREATE UNIQUE INDEX "payments_external_id_idx" ON "public"."payments" USING "btree" ("external_payment_id") WHERE ("external_payment_id" IS NOT NULL);



CREATE INDEX "push_subscriptions_admin_user_idx" ON "public"."push_subscriptions" USING "btree" ("admin_user_id");



CREATE UNIQUE INDEX "service_catalog_code_idx" ON "public"."service_catalog" USING "btree" ("code") WHERE (("code" IS NOT NULL) AND ("code" <> ''::"text"));



CREATE INDEX "service_entries_client_date_idx" ON "public"."service_entries" USING "btree" ("client_id", "service_date");



CREATE UNIQUE INDEX "service_entries_delivery_code_idx" ON "public"."service_entries" USING "btree" ("delivery_code") WHERE ("delivery_code" IS NOT NULL);



CREATE INDEX "service_tracking_links_active_client_idx" ON "public"."service_tracking_links" USING "btree" ("client_id") WHERE ("active" = true);



CREATE INDEX "service_tracking_links_client_period_idx" ON "public"."service_tracking_links" USING "btree" ("client_id", "period_start", "period_end");



CREATE UNIQUE INDEX "service_tracking_links_full_token_idx" ON "public"."service_tracking_links" USING "btree" ("full_token_hash") WHERE ("full_token_hash" IS NOT NULL);



CREATE INDEX "supplier_entries_payable_idx" ON "public"."supplier_entries" USING "btree" ("payable_id");



CREATE INDEX "supplier_entries_supplier_date_idx" ON "public"."supplier_entries" USING "btree" ("supplier_id", "service_date" DESC);



CREATE INDEX "supplier_payments_payable_idx" ON "public"."supplier_payments" USING "btree" ("payable_id");



CREATE INDEX "supplier_portal_links_active_supplier_idx" ON "public"."supplier_portal_links" USING "btree" ("supplier_id") WHERE ("active" = true);



CREATE INDEX "supplier_portal_supplier_period_idx" ON "public"."supplier_portal_links" USING "btree" ("supplier_id", "period_start", "period_end");



CREATE UNIQUE INDEX "supplier_service_code_idx" ON "public"."supplier_services" USING "btree" ("supplier_id", "code") WHERE (("code" IS NOT NULL) AND "active");



CREATE OR REPLACE TRIGGER "clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payment_methods_updated_at" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "price_tables_updated_at" BEFORE UPDATE ON "public"."price_tables" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "service_catalog_updated_at" BEFORE UPDATE ON "public"."service_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "service_entries_status_dates" BEFORE INSERT OR UPDATE OF "status" ON "public"."service_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_service_status_dates"();



CREATE OR REPLACE TRIGGER "service_entries_updated_at" BEFORE UPDATE ON "public"."service_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "service_prices_updated_at" BEFORE UPDATE ON "public"."service_prices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "supplier_entries_status_dates" BEFORE INSERT OR UPDATE OF "status" ON "public"."supplier_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_service_status_dates"();



CREATE OR REPLACE TRIGGER "supplier_entries_updated_at" BEFORE UPDATE ON "public"."supplier_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "supplier_payables_updated_at" BEFORE UPDATE ON "public"."supplier_payables" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "supplier_payments_updated_at" BEFORE UPDATE ON "public"."supplier_payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "supplier_services_updated_at" BEFORE UPDATE ON "public"."supplier_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billings"
    ADD CONSTRAINT "billings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."client_access_credentials"
    ADD CONSTRAINT "client_access_credentials_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "public"."billings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_access_credentials"
    ADD CONSTRAINT "client_access_credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_requesters"
    ADD CONSTRAINT "client_requesters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_service_requests"
    ADD CONSTRAINT "client_service_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_service_requests"
    ADD CONSTRAINT "client_service_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_price_table_id_fkey" FOREIGN KEY ("price_table_id") REFERENCES "public"."price_tables"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_billing_fk" FOREIGN KEY ("billing_id") REFERENCES "public"."billings"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_entries"
    ADD CONSTRAINT "service_entries_billing_fk" FOREIGN KEY ("billing_id") REFERENCES "public"."billings"("id");



ALTER TABLE ONLY "public"."service_entries"
    ADD CONSTRAINT "service_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."service_entries"
    ADD CONSTRAINT "service_entries_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id");



ALTER TABLE ONLY "public"."service_prices"
    ADD CONSTRAINT "service_prices_price_table_id_fkey" FOREIGN KEY ("price_table_id") REFERENCES "public"."price_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_prices"
    ADD CONSTRAINT "service_prices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_tracking_links"
    ADD CONSTRAINT "service_tracking_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_entries"
    ADD CONSTRAINT "supplier_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."supplier_entries"
    ADD CONSTRAINT "supplier_entries_client_service_entry_id_fkey" FOREIGN KEY ("client_service_entry_id") REFERENCES "public"."service_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_entries"
    ADD CONSTRAINT "supplier_entries_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "public"."supplier_payables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_entries"
    ADD CONSTRAINT "supplier_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_entries"
    ADD CONSTRAINT "supplier_entries_supplier_service_id_fkey" FOREIGN KEY ("supplier_service_id") REFERENCES "public"."supplier_services"("id");



ALTER TABLE ONLY "public"."supplier_payables"
    ADD CONSTRAINT "supplier_payables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "public"."supplier_payables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_portal_links"
    ADD CONSTRAINT "supplier_portal_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_services"
    ADD CONSTRAINT "supplier_services_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



CREATE POLICY "Admin gerencia pedidos de clientes" ON "public"."client_service_requests" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users_admin_all" ON "public"."admin_users" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."billings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billings_admin_all" ON "public"."billings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."client_access_credentials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_credentials_admin_all" ON "public"."client_access_credentials" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."client_requesters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_requesters_admin_all" ON "public"."client_requesters" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."client_service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_admin_all" ON "public"."clients" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_methods_admin_all" ON "public"."payment_methods" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_admin_all" ON "public"."payments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."price_tables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "price_tables_admin_all" ON "public"."price_tables" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."push_notified_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_notified_alerts_admin_all" ON "public"."push_notified_alerts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_admin_all" ON "public"."push_subscriptions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."service_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_catalog_admin_all" ON "public"."service_catalog" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."service_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_entries_admin_all" ON "public"."service_entries" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."service_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_prices_admin_all" ON "public"."service_prices" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."service_tracking_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_entries_admin_all" ON "public"."supplier_entries" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."supplier_payables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_payables_admin_all" ON "public"."supplier_payables" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."supplier_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_payments_admin_all" ON "public"."supplier_payments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."supplier_portal_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_portal_links_admin_all" ON "public"."supplier_portal_links" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."supplier_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_services_admin_all" ON "public"."supplier_services" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_admin_all" ON "public"."suppliers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."whatsapp_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_sessions_admin_all" ON "public"."whatsapp_sessions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."billings" TO "anon";
GRANT ALL ON TABLE "public"."billings" TO "authenticated";
GRANT ALL ON TABLE "public"."billings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."client_access_credentials" TO "anon";
GRANT ALL ON TABLE "public"."client_access_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."client_access_credentials" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."client_requesters" TO "anon";
GRANT ALL ON TABLE "public"."client_requesters" TO "authenticated";
GRANT ALL ON TABLE "public"."client_requesters" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."client_service_requests" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."client_service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."client_service_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."price_tables" TO "anon";
GRANT ALL ON TABLE "public"."price_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."price_tables" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_notified_alerts" TO "anon";
GRANT ALL ON TABLE "public"."push_notified_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notified_alerts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_catalog" TO "anon";
GRANT ALL ON TABLE "public"."service_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."service_catalog" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_entries" TO "anon";
GRANT ALL ON TABLE "public"."service_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."service_entries" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_prices" TO "anon";
GRANT ALL ON TABLE "public"."service_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."service_prices" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_tracking_links" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_tracking_links" TO "authenticated";
GRANT ALL ON TABLE "public"."service_tracking_links" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."supplier_entries" TO "anon";
GRANT ALL ON TABLE "public"."supplier_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_entries" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."supplier_payables" TO "anon";
GRANT ALL ON TABLE "public"."supplier_payables" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_payables" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."supplier_payments" TO "anon";
GRANT ALL ON TABLE "public"."supplier_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_payments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."supplier_portal_links" TO "anon";
GRANT ALL ON TABLE "public"."supplier_portal_links" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_portal_links" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."supplier_services" TO "anon";
GRANT ALL ON TABLE "public"."supplier_services" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_services" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."whatsapp_sessions" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







