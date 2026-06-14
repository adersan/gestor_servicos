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
      billingsResult
    ] = await Promise.all([
      client.from("price_tables").select("*").eq("active", true).order("name"),
      client.from("clients").select("*").eq("active", true).order("name"),
      client.from("service_catalog").select("*").eq("active", true).order("name"),
      client.from("service_prices").select("*"),
      client.from("service_entries").select("*").order("service_date", { ascending: false }),
      client.from("payments").select("*").order("payment_date", { ascending: false }),
      client.from("payment_methods").select("*").order("created_at"),
      client.from("billings").select("*").order("created_at", { ascending: false })
    ]);

    const results = [
      priceTablesResult,
      clientsResult,
      catalogResult,
      pricesResult,
      entriesResult,
      paymentsResult,
      methodsResult,
      billingsResult
    ];
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;

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
        priceGroup: tableById[client.price_table_id] || ""
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
        reference: entry.reference || "",
        amount: Number(entry.amount),
        status: entry.status,
        deliveryCode: entry.delivery_code || "",
        confirmationRequestedAt: entry.confirmation_requested_at,
        deliveredAt: entry.delivered_at,
        deliverySource: entry.delivery_source || "",
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
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
        password: "",
        status: billing.status,
        active: billing.status !== "Cancelada",
        createdAt: billing.created_at
      }))
    };
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
      const clientsResult = await client.from("clients").upsert(
        state.clients.map((item) => ({
          id: item.id,
          name: item.name,
          phone: item.phone || null,
          price_table_id: existingByName[item.priceGroup] || null,
          active: true
        }))
      );
      if (clientsResult.error) throw clientsResult.error;
    }

    if (state.services.length) {
      const entries = state.services.map((item) => ({
          id: item.id,
          client_id: item.clientId,
          service_id: item.catalogId || null,
          service_name: item.description,
          reference: item.reference || null,
          service_date: item.date,
          amount: Number(item.amount),
          status: item.status,
          billing_id: item.billingId || null,
          delivery_code: item.deliveryCode || null,
          confirmation_requested_at: item.confirmationRequestedAt || null,
          delivered_at: item.deliveredAt || null,
          delivery_source: item.deliverySource || null
        }));
      let entriesResult = await client.from("service_entries").upsert(entries);
      if (entriesResult.error && /delivery_(code|source)|confirmation_requested_at|delivered_at/i.test(entriesResult.error.message || "")) {
        const compatibleEntries = entries.map((entry) => {
          const {
            delivery_code,
            confirmation_requested_at,
            delivered_at,
            delivery_source,
            ...compatibleEntry
          } = entry;
          return compatibleEntry;
        });
        entriesResult = await client.from("service_entries").upsert(compatibleEntries);
      }
      if (entriesResult.error) throw entriesResult.error;
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
          client_id: item.clientId,
          period_start: item.startDate,
          period_end: item.endDate,
          previous_balance: Number(item.previousBalance || 0),
          services_total: Number(item.servicesTotal || 0),
          payments_total: Number(item.paymentsTotal || 0),
          total_due: Number(item.amount),
          status: item.status || "Aberta",
          snapshot: {
            identifier: item.identifier,
            paymentMethodIds: item.paymentMethodIds || [],
            paymentMethods: item.paymentMethods || [],
            sendHistory: item.sendHistory || [],
            historyEnabled: Boolean(item.historyEnabled)
          },
          created_at: item.createdAt
        }))
      );
      if (billingsResult.error) throw billingsResult.error;
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
    await deleteMissing("service_entries", state.services.map((item) => item.id));
    await deleteMissing("billings", state.billings.map((item) => item.id));
    await deleteMissing("payment_methods", state.paymentMethods.map((item) => item.id));
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
  function scheduleSave(state, onError) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      upsertState(state).catch(onError);
    }, 350);
  }

  window.dataStore = {
    fetchAll,
    upsertState,
    scheduleSave
  };
})();
