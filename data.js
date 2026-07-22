(function () {
  function requireClient() {
    if (!window.supabaseClient) {
      throw new Error("Supabase ainda não foi inicializado.");
    }
    return window.supabaseClient;
  }

  async function fetchAll() {
    const client = requireClient();
    const [
      priceTablesResult,
      clientsResult,
      catalogResult,
      pricesResult,
      entriesResult,
      paymentsResult,
      methodsResult,
      billingsResult,
      suppliersResult,
      supplierServicesResult,
      supplierEntriesResult,
      supplierPayablesResult,
      supplierPaymentsResult
    ] = await Promise.all([
      client.from("price_tables").select("*").eq("active", true).order("name"),
      client.from("clients").select("*").eq("active", true).order("name"),
      client.from("service_catalog").select("*").eq("active", true).order("name"),
      client.from("service_prices").select("*"),
      client.from("service_entries").select("*").order("service_date", { ascending: false }),
      client.from("payments").select("*").order("payment_date", { ascending: false }),
      client.from("payment_methods").select("*").order("created_at"),
      client.from("billings").select("*").order("created_at", { ascending: false }),
      client.from("suppliers").select("*").eq("active", true).order("name"),
      client.from("supplier_services").select("*").eq("active", true).order("name"),
      client.from("supplier_entries").select("*").order("service_date", { ascending: false }),
      client.from("supplier_payables").select("*").order("created_at", { ascending: false }),
      client.from("supplier_payments").select("*").order("payment_date", { ascending: false })
    ]);

    const results = [
      priceTablesResult,
      clientsResult,
      catalogResult,
      pricesResult,
      entriesResult,
      paymentsResult,
      methodsResult,
      billingsResult,
      suppliersResult,
      supplierServicesResult,
      supplierEntriesResult,
      supplierPayablesResult,
      supplierPaymentsResult
    ];
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;

    let clientRequestsResult = { data: [] };
    const requestsResult = await fetchClientServiceRequests(client);
    if (requestsResult.error) {
      const message = requestsResult.error.message || "";
      if (!/client_service_requests|schema cache|does not exist|Could not find/i.test(message)) throw requestsResult.error;
    } else {
      clientRequestsResult = requestsResult;
    }
    let clientRequestersResult = { data: [] };
    const requestersResult = await client.from("client_requesters").select("*").eq("active", true).order("name");
    if (requestersResult.error) {
      const message = requestersResult.error.message || "";
      if (!/client_requesters|schema cache|does not exist|Could not find/i.test(message)) throw requestersResult.error;
    } else {
      clientRequestersResult = requestersResult;
    }
    let paymentLinksResult = { data: [] };
    const linksResult = await client.from("payment_links").select("*").order("created_at", { ascending: false });
    if (linksResult.error) {
      const message = linksResult.error.message || "";
      if (!/payment_links|schema cache|does not exist|Could not find/i.test(message)) throw linksResult.error;
    } else {
      paymentLinksResult = linksResult;
    }

    const priceTables = priceTablesResult.data;
    const tableById = Object.fromEntries(priceTables.map((table) => [table.id, table.name]));
    const pricesByService = {};
    pricesResult.data.forEach((price) => {
      pricesByService[price.service_id] ||= {};
      pricesByService[price.service_id][tableById[price.price_table_id]] = Number(price.amount);
    });

    return {
      priceTables: priceTables.map((table) => table.name),
      clients: clientsResult.data.map((client) => ({
        id: client.id,
        name: client.name,
        phone: client.phone || "",
        document: client.document || "",
        email: client.email || "",
        contactName: client.contact_name || "",
        zipCode: client.zip_code || "",
        address: client.address || "",
        addressNumber: client.address_number || "",
        addressComplement: client.address_complement || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        notes: client.notes || "",
        priceGroup: tableById[client.price_table_id] || "",
        billingFrequency: client.billing_frequency || "semanal"
      })),
      catalog: catalogResult.data.map((service) => ({
        id: service.id,
        code: service.code || "",
        name: service.name,
        prices: pricesByService[service.id] || {}
      })),
      services: entriesResult.data.map((entry) => ({
        id: entry.id,
        clientId: entry.client_id,
        catalogId: entry.service_id,
        billingId: entry.billing_id,
        date: entry.service_date,
        description: entry.service_name,
        requestedBy: entry.requested_by || "",
        reference: entry.reference || "",
        amount: Number(entry.amount),
        status: entry.status,
        notes: entry.notes || "",
        doneAt: entry.done_at,
        deliveryCode: entry.delivery_code || "",
        confirmationRequestedAt: entry.confirmation_requested_at,
        deliveredAt: entry.delivered_at,
        deliverySource: entry.delivery_source || "",
        serviceGroupId: entry.service_group_id || "",
        primaryEntryId: entry.primary_entry_id || "",
        isSecondary: Boolean(entry.is_secondary),
        cancellationReason: entry.cancellation_reason || "",
        cancellationOriginalAmount: entry.cancellation_original_amount === null
          ? null
          : Number(entry.cancellation_original_amount),
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      })),
      clientRequesters: clientRequestersResult.data.map((item) => ({
        id: item.id,
        clientId: item.client_id,
        name: item.name,
        normalizedName: item.normalized_name,
        active: item.active !== false
      })),
      payments: paymentsResult.data.map((payment) => ({
        id: payment.id,
        clientId: payment.client_id,
        billingId: payment.billing_id,
        date: payment.payment_date,
        amount: Number(payment.amount),
        method: payment.method || "",
        note: payment.notes || "",
        externalPaymentId: payment.external_payment_id || "",
        paymentSource: payment.payment_source || "Manual",
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      })),
      paymentMethods: methodsResult.data.map((method) => ({
        id: method.id,
        type: method.type,
        name: method.name,
        details: method.details || "",
        link: method.payment_link || "",
        active: method.active
      })),
      billings: billingsResult.data.map((billing) => ({
        id: billing.id,
        billingNumber: billing.billing_number || null,
        clientId: billing.client_id,
        startDate: billing.period_start,
        endDate: billing.period_end,
        amount: Number(billing.total_due),
        previousBalance: Number(billing.previous_balance),
        servicesTotal: Number(billing.services_total),
        paymentsTotal: Number(billing.payments_total),
        identifier: billing.snapshot?.identifier || "",
        paymentMethodIds: billing.snapshot?.paymentMethodIds || [],
        paymentMethods: billing.snapshot?.paymentMethods || [],
        sendHistory: billing.snapshot?.sendHistory || [],
        historyEnabled: Boolean(billing.snapshot?.historyEnabled),
        paymentIds: billing.snapshot?.paymentIds || [],
        creditGenerated: Number(billing.snapshot?.creditGenerated || 0),
        statusReason: billing.snapshot?.statusReason || "",
        calculationVersion: Number(billing.snapshot?.calculationVersion || 1),
        rolledIntoBillingId: billing.snapshot?.rolledIntoBillingId || null,
        rolledAt: billing.snapshot?.rolledAt || null,
        rolledBillingIds: billing.snapshot?.rolledBillingIds || [],
        rolledBalance: Number(billing.snapshot?.rolledBalance || 0),
        cardSurchargePercent: Number(billing.snapshot?.cardSurchargePercent || 0),
        password: "",
        status: billing.snapshot?.rolledIntoBillingId ? "Consolidada" : billing.status,
        active: billing.status !== "Cancelada",
        createdAt: billing.created_at
      })),
      suppliers: suppliersResult.data.map((item) => ({
        id: item.id, name: item.name, phone: item.phone || "", document: item.document || "",
        notes: item.notes || "", isDefault: item.is_default, active: item.active,
        whatsappDestination: item.whatsapp_destination || "individual",
        whatsappGroupName: item.whatsapp_group_name || ""
      })),
      supplierServices: supplierServicesResult.data.map((item) => ({
        id: item.id, supplierId: item.supplier_id, code: item.code || "",
        name: item.name, cost: Number(item.default_cost), active: item.active
      })),
      supplierEntries: supplierEntriesResult.data.map((item) => ({
        id: item.id, supplierId: item.supplier_id, supplierServiceId: item.supplier_service_id,
        clientId: item.client_id, clientServiceEntryId: item.client_service_entry_id,
        payableId: item.payable_id, date: item.service_date, description: item.service_name,
        reference: item.reference || "", amount: Number(item.amount), status: item.status,
        source: item.source, notes: item.notes || "",
        lastChangedBy: item.last_changed_by || "",
        doneAt: item.done_at, deliveredAt: item.delivered_at,
        cancellationReason: item.cancellation_reason || "",
        cancellationOriginalAmount: item.cancellation_original_amount === null
          ? null
          : Number(item.cancellation_original_amount),
        createdAt: item.created_at, updatedAt: item.updated_at
      })),
      supplierPayables: supplierPayablesResult.data.map((item) => ({
        id: item.id, supplierId: item.supplier_id, startDate: item.period_start,
        endDate: item.period_end, amount: Number(item.total_due), status: item.status,
        snapshot: item.snapshot || {}, createdAt: item.created_at
      })),
      supplierPayments: supplierPaymentsResult.data.map((item) => ({
        id: item.id, supplierId: item.supplier_id, payableId: item.payable_id,
        date: item.payment_date, amount: Number(item.amount), method: item.method || "",
        note: item.notes || "", paymentSource: item.payment_source || "", createdAt: item.created_at
      })),
      serviceRequests: clientRequestsResult.data.map((item) => ({
        id: item.id,
        clientId: item.client_id,
        catalogId: item.service_id || "",
        serviceName: item.service_name || "",
        references: Array.isArray(item.references_list) ? item.references_list : [],
        requestedDate: item.requested_date,
        amount: Number(item.amount || 0),
        requestedBy: item.requested_by || "",
        notes: item.notes || "",
        status: item.status || "Novo",
        importedEntryIds: item.imported_entry_ids || [],
        importedAt: item.imported_at || null,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),
      paymentLinks: paymentLinksResult.data.map((item) => ({
        id: item.id,
        clientId: item.client_id,
        amount: Number(item.amount),
        status: item.status,
        initPoint: item.init_point || "",
        paymentId: item.payment_id || "",
        createdAt: item.created_at,
        paidAt: item.paid_at || null
      }))
    };
  }

  async function fetchClientServiceRequests(client) {
    try {
      const session = await client.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (accessToken) {
        const response = await fetch("/.netlify/functions/admin-client-service-requests", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok) return { data: result.requests || [] };
      }
    } catch (error) {
      console.warn("Falha ao consultar pedidos pela função administrativa:", error);
    }
    return client.from("client_service_requests").select("*").order("created_at", { ascending: false });
  }

  async function upsertState(state) {
    const client = requireClient();

    const existingTables = await client.from("price_tables").select("id,name");
    if (existingTables.error) throw existingTables.error;
    const existingByName = Object.fromEntries(existingTables.data.map((table) => [table.name, table.id]));

    const missingTables = state.priceTables
      .filter((name) => !existingByName[name])
      .map((name) => ({ name, active: true }));
    if (missingTables.length) {
      const inserted = await client.from("price_tables").insert(missingTables).select("id,name");
      if (inserted.error) throw inserted.error;
      inserted.data.forEach((table) => { existingByName[table.name] = table.id; });
    }

    if (state.catalog.length) {
      const catalogResult = await client.from("service_catalog").upsert(
        state.catalog.map((service) => ({
          id: service.id,
          code: service.code || null,
          name: service.name,
          active: true
        }))
      );
      if (catalogResult.error) throw catalogResult.error;
    }

    const servicePrices = state.catalog.flatMap((service) =>
      state.priceTables.map((tableName) => ({
        service_id: service.id,
        price_table_id: existingByName[tableName],
        amount: Number(service.prices[tableName] || 0)
      }))
    );
    if (servicePrices.length) {
      const pricesResult = await client.from("service_prices").upsert(servicePrices);
      if (pricesResult.error) throw pricesResult.error;
    }

    if (state.clients.length) {
      const clientRows = state.clients.map((item) => ({
          id: item.id,
          name: item.name,
          phone: item.phone || null,
          document: item.document || null,
          email: item.email || null,
          contact_name: item.contactName || null,
          zip_code: item.zipCode || null,
          address: item.address || null,
          address_number: item.addressNumber || null,
          address_complement: item.addressComplement || null,
          neighborhood: item.neighborhood || null,
          city: item.city || null,
          state: item.state || null,
          notes: item.notes || null,
          price_table_id: existingByName[item.priceGroup] || null,
          billing_frequency: item.billingFrequency || "semanal",
          active: true
        }));
      let clientsResult = await client.from("clients").upsert(clientRows);
      if (clientsResult.error && /document|email|contact_name|zip_code|address|neighborhood|city|state|notes|billing_frequency|schema cache|Could not find/i.test(clientsResult.error.message || "")) {
        clientsResult = await client.from("clients").upsert(clientRows.map(({
          document, email, contact_name, zip_code, address, address_number,
          address_complement, neighborhood, city, state, notes, billing_frequency, ...row
        }) => row));
      }
      if (clientsResult.error) throw clientsResult.error;
    }

    if (state.services.length) {
      const entries = state.services.map((item) => ({
          id: item.id,
          client_id: item.clientId,
          service_id: item.catalogId || null,
          service_name: item.description,
          requested_by: item.requestedBy || null,
          reference: item.reference || null,
          service_date: item.date,
          amount: Number(item.amount),
          status: item.status,
          notes: item.notes || null,
          done_at: item.doneAt || null,
          billing_id: item.billingId || null,
          delivery_code: item.deliveryCode || null,
          confirmation_requested_at: item.confirmationRequestedAt || null,
          delivered_at: item.deliveredAt || null,
          delivery_source: item.deliverySource || null,
          service_group_id: item.serviceGroupId || null,
          primary_entry_id: item.primaryEntryId || null,
          is_secondary: Boolean(item.isSecondary),
          cancellation_reason: item.cancellationReason || null,
          cancellation_original_amount: item.cancellationOriginalAmount ?? null
        }));
      let entriesResult = await client.from("service_entries").upsert(entries);
      if (entriesResult.error && /requested_by|done_at|delivery_(code|source)|confirmation_requested_at|delivered_at|service_group_id|primary_entry_id|is_secondary|cancellation_reason|cancellation_original_amount/i.test(entriesResult.error.message || "")) {
        const compatibleEntries = entries.map((entry) => {
          const {
            requested_by,
            done_at,
            delivery_code,
            confirmation_requested_at,
            delivered_at,
            delivery_source,
            service_group_id,
            primary_entry_id,
            is_secondary,
            cancellation_reason,
            cancellation_original_amount,
            ...compatibleEntry
          } = entry;
          return compatibleEntry;
        });
        entriesResult = await client.from("service_entries").upsert(compatibleEntries);
      }
      if (entriesResult.error) throw entriesResult.error;
    }

    if (state.clientRequesters?.length) {
      const requesterRows = state.clientRequesters.map((item) => ({
        id: item.id,
        client_id: item.clientId,
        name: item.name,
        normalized_name: item.normalizedName || String(item.name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"),
        active: item.active !== false
      }));
      const requestersResult = await client.from("client_requesters").upsert(requesterRows);
      if (requestersResult.error && !/client_requesters|schema cache|does not exist|Could not find/i.test(requestersResult.error.message || "")) {
        throw requestersResult.error;
      }
    }

    if (state.payments.length) {
      const payments = state.payments.map((item) => ({
          id: item.id,
          client_id: item.clientId,
          payment_date: item.date,
          amount: Number(item.amount),
          method: item.method || null,
          notes: item.note || null,
          billing_id: item.billingId || null,
          external_payment_id: item.externalPaymentId || null,
          payment_source: item.paymentSource || "Manual",
          created_at: item.createdAt
        }));
      let paymentsResult = await client.from("payments").upsert(payments);
      if (paymentsResult.error && /external_payment_id|payment_source/i.test(paymentsResult.error.message || "")) {
        const compatiblePayments = payments.map((payment) => {
          const { external_payment_id, payment_source, ...compatiblePayment } = payment;
          return compatiblePayment;
        });
        paymentsResult = await client.from("payments").upsert(compatiblePayments);
      }
      if (paymentsResult.error) throw paymentsResult.error;
    }

    if (state.paymentMethods.length) {
      const methodsResult = await client.from("payment_methods").upsert(
        state.paymentMethods.map((item) => ({
          id: item.id,
          type: item.type,
          name: item.name,
          details: item.details || null,
          payment_link: item.link || null,
          active: item.active
        }))
      );
      if (methodsResult.error) throw methodsResult.error;
    }

    if (state.billings.length) {
      const billingsResult = await client.from("billings").upsert(
        state.billings.map((item) => ({
          id: item.id,
          billing_number: item.billingNumber || null,
          client_id: item.clientId,
          period_start: item.startDate,
          period_end: item.endDate,
          previous_balance: Number(item.previousBalance || 0),
          services_total: Number(item.servicesTotal || 0),
          payments_total: Number(item.paymentsTotal || 0),
          total_due: Number(item.amount),
          status: item.rolledIntoBillingId ? "Paga" : (item.status || "Aberta"),
          snapshot: {
            identifier: item.identifier,
            paymentMethodIds: item.paymentMethodIds || [],
            paymentMethods: item.paymentMethods || [],
            sendHistory: item.sendHistory || [],
            historyEnabled: Boolean(item.historyEnabled),
            paymentIds: item.paymentIds || [],
            creditGenerated: Number(item.creditGenerated || 0),
            statusReason: item.statusReason || "",
            calculationVersion: Number(item.calculationVersion || 1),
            rolledIntoBillingId: item.rolledIntoBillingId || null,
            rolledAt: item.rolledAt || null,
            rolledBillingIds: item.rolledBillingIds || [],
            rolledBalance: Number(item.rolledBalance || 0),
            cardSurchargePercent: Number(item.cardSurchargePercent || 0)
          },
          created_at: item.createdAt
        }))
      );
      if (billingsResult.error) throw billingsResult.error;
    }

    if (state.suppliers?.length) {
      const defaultSupplier = state.suppliers.find((item) => item.isDefault);
      if (defaultSupplier) {
        const clearDefault = await client.from("suppliers")
          .update({ is_default: false })
          .eq("is_default", true);
        if (clearDefault.error) throw clearDefault.error;
      }
      const supplierRows = state.suppliers.map((item) => ({
        id: item.id, name: item.name, phone: item.phone || null, document: item.document || null,
        notes: item.notes || null, is_default: false, active: item.active !== false,
        whatsapp_destination: item.whatsappDestination || "individual",
        whatsapp_group_name: item.whatsappGroupName || null
      }));
      let result = await client.from("suppliers").upsert(supplierRows);
      if (result.error && /whatsapp_destination|whatsapp_group_name/i.test(result.error.message || "")) {
        result = await client.from("suppliers").upsert(supplierRows.map(({
          whatsapp_destination, whatsapp_group_name, ...item
        }) => item));
      }
      if (result.error) throw result.error;
      if (defaultSupplier) {
        const setDefault = await client.from("suppliers")
          .update({ is_default: true })
          .eq("id", defaultSupplier.id);
        if (setDefault.error) throw setDefault.error;
      }
    }
    if (state.supplierServices?.length) {
      const result = await client.from("supplier_services").upsert(state.supplierServices.map((item) => ({
        id: item.id, supplier_id: item.supplierId, code: item.code || null,
        name: item.name, default_cost: Number(item.cost), active: item.active !== false
      })));
      if (result.error) throw result.error;
    }
    if (state.supplierPayables?.length) {
      const result = await client.from("supplier_payables").upsert(state.supplierPayables.map((item) => ({
        id: item.id, supplier_id: item.supplierId, period_start: item.startDate,
        period_end: item.endDate, total_due: Number(item.amount), status: item.status,
        snapshot: item.snapshot || {}, created_at: item.createdAt
      })));
      if (result.error) throw result.error;
    }
    if (state.supplierEntries?.length) {
      const validClientServiceIds = new Set(state.services.map((item) => item.id));
      const supplierEntryRows = state.supplierEntries.map((item) => ({
        id: item.id, supplier_id: item.supplierId, supplier_service_id: item.supplierServiceId || null,
        client_id: item.clientId || null,
        client_service_entry_id: item.clientServiceEntryId && validClientServiceIds.has(item.clientServiceEntryId)
          ? item.clientServiceEntryId
          : null,
        payable_id: item.payableId || null, service_date: item.date, service_name: item.description,
        reference: item.reference || null, amount: Number(item.amount), status: item.status,
        source: item.source || "Direto", notes: item.notes || null,
        last_changed_by: item.lastChangedBy || null,
        done_at: item.doneAt || null, delivered_at: item.deliveredAt || null,
        cancellation_reason: item.cancellationReason || null,
        cancellation_original_amount: item.cancellationOriginalAmount ?? null,
        created_at: item.createdAt
      }));
      let result = await client.from("supplier_entries").upsert(supplierEntryRows);
      if (result.error && /last_changed_by|done_at|delivered_at/i.test(result.error.message || "")) {
        result = await client.from("supplier_entries").upsert(supplierEntryRows.map(({
          last_changed_by, done_at, delivered_at, ...item
        }) => item));
      }
      if (result.error) throw result.error;
    }
    if (state.supplierPayments?.length) {
      const result = await client.from("supplier_payments").upsert(state.supplierPayments.map((item) => ({
        id: item.id, supplier_id: item.supplierId, payable_id: item.payableId || null,
        payment_date: item.date, amount: Number(item.amount), method: item.method || null,
        notes: item.note || null, payment_source: item.paymentSource || null, created_at: item.createdAt
      })));
      if (result.error) throw result.error;
    }
    if (state.serviceRequests?.length) {
      const rows = state.serviceRequests.map((item) => ({
        id: item.id,
        client_id: item.clientId,
        service_id: item.catalogId || null,
        service_name: item.serviceName,
        references_list: item.references || [],
        requested_date: item.requestedDate,
        amount: Number(item.amount || 0),
        requested_by: item.requestedBy || null,
        notes: item.notes || null,
        status: item.status || "Novo",
        imported_entry_ids: item.importedEntryIds || [],
        imported_at: item.importedAt || null,
        created_at: item.createdAt
      }));
      const result = await client.from("client_service_requests").upsert(rows, { onConflict: "id" });
      if (result.error && !/client_service_requests|schema cache|does not exist|Could not find/i.test(result.error.message || "")) {
        console.warn("Falha ao sincronizar pedidos recebidos:", result.error.message || result.error);
      }
    }

    async function deleteMissing(table, localIds) {
      const existing = await client.from(table).select("id");
      if (existing.error) throw existing.error;
      const localSet = new Set(localIds);
      const missingIds = existing.data
        .map((item) => item.id)
        .filter((id) => !localSet.has(id));
      if (!missingIds.length) return;
      const removed = await client.from(table).delete().in("id", missingIds);
      if (removed.error) throw removed.error;
    }

    await deleteMissing("payments", state.payments.map((item) => item.id));
    await deleteMissing("supplier_entries", (state.supplierEntries || []).map((item) => item.id));
    await deleteMissing("service_entries", state.services.map((item) => item.id));
    await deleteMissing("billings", state.billings.map((item) => item.id));
    await deleteMissing("payment_methods", state.paymentMethods.map((item) => item.id));
    await deleteMissing("supplier_payments", (state.supplierPayments || []).map((item) => item.id));
    await deleteMissing("supplier_payables", (state.supplierPayables || []).map((item) => item.id));
    await deleteMissing("supplier_services", (state.supplierServices || []).map((item) => item.id));
    await deleteMissing("suppliers", (state.suppliers || []).map((item) => item.id));
    await deleteMissing("clients", state.clients.map((item) => item.id));
    await deleteMissing("service_catalog", state.catalog.map((item) => item.id));

    const activeTableNames = new Set(state.priceTables);
    const removedTableIds = existingTables.data
      .filter((table) => !activeTableNames.has(table.name))
      .map((table) => table.id);
    if (removedTableIds.length) {
      const removedTables = await client.from("price_tables").delete().in("id", removedTableIds);
      if (removedTables.error) throw removedTables.error;
    }
  }

  let saveTimer;
  let pendingState = null;
  let pendingOnError = null;
  let activeSave = null;

  function snapshotState(state) {
    return typeof structuredClone === "function"
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state));
  }

  function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (activeSave) return activeSave.then(() => flushSave());
    if (!pendingState) return Promise.resolve();
    const state = pendingState;
    const onError = pendingOnError;
    pendingState = null;
    pendingOnError = null;
    activeSave = upsertState(state)
      .catch((error) => {
        onError?.(error);
        throw error;
      })
      .finally(() => {
        activeSave = null;
      });
    return activeSave;
  }

  function scheduleSave(state, onError) {
    clearTimeout(saveTimer);
    pendingState = snapshotState(state);
    pendingOnError = onError;
    saveTimer = setTimeout(() => {
      flushSave().catch(() => {});
    }, 350);
  }

  function saveNow(state) {
    clearTimeout(saveTimer);
    saveTimer = null;
    pendingState = null;
    pendingOnError = null;
    const snapshot = snapshotState(state);
    if (activeSave) return activeSave.then(() => saveNow(snapshot));
    activeSave = upsertState(snapshot).finally(() => {
      activeSave = null;
    });
    return activeSave;
  }

  async function requestAdminClientServiceRequest(method, body) {
    const client = requireClient();
    const session = await client.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) throw new Error("Sessão administrativa expirada.");
    const response = await fetch("/.netlify/functions/admin-client-service-requests", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o pedido.");
    return result;
  }

  function deleteClientServiceRequest(id) {
    return requestAdminClientServiceRequest("DELETE", { id });
  }

  function updateClientServiceRequest(id, values) {
    return requestAdminClientServiceRequest("PATCH", { id, values });
  }

  async function cancelPaymentLink(id) {
    const client = requireClient();
    const { error } = await client.from("payment_links").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
  }

  window.dataStore = {
    fetchAll,
    upsertState,
    scheduleSave,
    flushSave,
    saveNow,
    deleteClientServiceRequest,
    updateClientServiceRequest,
    cancelPaymentLink,
    hasPendingSave: () => Boolean(pendingState),
    hasUnsyncedChanges: () => Boolean(pendingState || activeSave)
  };
})();
