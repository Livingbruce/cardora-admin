import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabase";
import "../../styles/dashboard/Orders.css";

const maskCard = (num) => {
  if (!num) return "N/A";
  const str = String(num);
  if (str.length <= 8) return str;
  return `${str.slice(0, 6)}xxxx...${str.slice(-4)}`;
};

const formatTimestamp = (iso) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
};

const loadOrdersData = async () => {
  const [
    cvvRes,
    shopRes,
    ccRes,
    dumpRes,
    avsRes,
    vbvRes,
    balRes,
    delivRes
  ] = await Promise.all([
    supabase.from("cvv_orders").select("*").order("id", { ascending: false }),
    supabase.from("shop_orders").select("*").order("id", { ascending: false }),
    supabase.from("cc_checker_orders").select("*").order("id", { ascending: false }),
    supabase.from("dump_checker_orders").select("*").order("id", { ascending: false }),
    supabase.from("avs_checker_orders").select("*").order("id", { ascending: false }),
    supabase.from("vbv_checker_orders").select("*").order("id", { ascending: false }),
    supabase.from("balance_checker_orders").select("*").order("id", { ascending: false }),
    supabase.from("order_deliveries").select("*").order("id", { ascending: false })
  ]);

  const errors = [
    cvvRes.error,
    shopRes.error,
    ccRes.error,
    dumpRes.error,
    avsRes.error,
    vbvRes.error,
    balRes.error,
    delivRes.error
  ].filter(Boolean);

  if (errors.length > 0) {
    console.error("Errors loading orders:", errors.map((e) => e.message).join(" | "));
  }

  const delivMap = {};
  (delivRes.data || []).forEach((row) => {
    const key = `${row.source_table}:${row.source_order_id}`;
    if (!delivMap[key]) {
      delivMap[key] = row;
    }
  });

  const normalized = [];

  (cvvRes.data || []).forEach((o) => {
    const summary =
      o.item_summary ||
      `CVV [${o.source_name || "Source 1"}] - ${maskCard(o.bin)} | ${o.bank || "N/A"} (${o.expiry || "--/--"})`;

    const details =
      o.full_details ||
      [
        `Source: ${o.source_name || "Source 1"}`,
        `BIN: ${o.bin || "N/A"}`,
        `Bank: ${o.bank || "N/A"}`,
        `Type / Level: ${o.card_type || "N/A"} / ${o.card_level || "N/A"}`,
        `Expiry: ${o.expiry || "N/A"}`,
        `Location: ${[o.city, o.state, o.zip, o.country].filter(Boolean).join(", ") || "N/A"}`,
        `Cardholder: ${o.fname || "N/A"}`,
        `Price: $${Number(o.price || 0).toFixed(2)}`
      ].join("\n");

    normalized.push({
      uid: `cvv_orders-${o.id}`,
      id: o.id,
      sourceTable: "cvv_orders",
      user: o.client_handle || "@guest_user",
      category: "CVV",
      isChecker: false,
      maskedDetails: summary,
      fullDetails: details,
      price: Number(o.price || 0),
      date: formatTimestamp(o.created_at),
      rawDate: o.created_at,
      status: o.status || "pending"
    });
  });

  (shopRes.data || []).forEach((o) => {
    const cat = o.category === "Novbv" ? "Novbv" : "Dumps";
    normalized.push({
      uid: `shop_orders-${o.id}`,
      id: o.id,
      sourceTable: "shop_orders",
      user: o.client_handle || "@guest_user",
      category: cat,
      isChecker: false,
      maskedDetails: o.item_summary,
      fullDetails: o.full_details,
      price: Number(o.price || 0),
      date: formatTimestamp(o.created_at),
      rawDate: o.created_at,
      status: o.status || "pending"
    });
  });

  (ccRes.data || []).forEach((o) => {
    normalized.push({
      uid: `cc_checker_orders-${o.id}`,
      id: o.id,
      sourceTable: "cc_checker_orders",
      user: o.client_handle || "@guest_user",
      category: "CC checker",
      isChecker: true,
      maskedDetails: `CC - ${maskCard(o.card_number)} (${o.exp_month}/${o.exp_year})`,
      fullDetails: [
        `Check Type: CC checker`,
        `Card Number: ${o.card_number}`,
        `Expiration: ${o.exp_month}/${o.exp_year}`,
        `CVV: ${o.cvv}`,
        `Fee: $${Number(o.fee ?? 0.75).toFixed(2)}`
      ].join("\n"),
      price: Number(o.fee ?? 0.75),
      date: formatTimestamp(o.created_at),
      rawDate: o.created_at,
      status: o.status || "pending"
    });
  });

  (dumpRes.data || []).forEach((o) => {
    const summary = o.track2
      ? `Track 2 - ${o.track2.slice(0, 14)}...`
      : `Dump Card - ${maskCard(o.card_number)} (${o.exp_month || "--"}/${o.exp_year || "--"})`;
    normalized.push({
      uid: `dump_checker_orders-${o.id}`,
      id: o.id,
      sourceTable: "dump_checker_orders",
      user: o.client_handle || "@guest_user",
      category: "Dump checker",
      isChecker: true,
      maskedDetails: summary,
      fullDetails: [
        `Check Type: Dump checker`,
        `Card Number: ${o.card_number || "N/A"}`,
        `Expiration: ${o.exp_month || "--"}/${o.exp_year || "--"}`,
        `Track 2: ${o.track2 || "N/A"}`,
        `Fee: $${Number(o.fee ?? 0.75).toFixed(2)}`
      ].join("\n"),
      price: Number(o.fee ?? 0.75),
      date: formatTimestamp(o.created_at),
      rawDate: o.created_at,
      status: o.status || "pending"
    });
  });

  (avsRes.data || []).forEach((o) => {
    normalized.push({
      uid: `avs_checker_orders-${o.id}`,
      id: o.id,
      sourceTable: "avs_checker_orders",
      user: o.client_handle || "@guest_user",
      category: "AVS checker",
      isChecker: true,
      maskedDetails: `AVS - ${maskCard(o.card_number)} | ${o.zip} (${o.country_code})`,
      fullDetails: [
        `Check Type: AVS checker`,
        `Card Number: ${o.card_number}`,
        `Expiration: ${o.exp_month}/${o.exp_year}`,
        `CVV: ${o.cvv || "Optional / None"}`,
        `Cardholder: ${o.first_name} ${o.last_name}`,
        `Address: ${o.address}, ${o.city}, ${o.state} ${o.zip}, ${o.country_code}`,
        `Fee: $${Number(o.fee ?? 0.75).toFixed(2)}`
      ].join("\n"),
      price: Number(o.fee ?? 0.75),
      date: formatTimestamp(o.created_at),
      rawDate: o.created_at,
      status: o.status || "pending"
    });
  });

  (vbvRes.data || []).forEach((o) => {
    normalized.push({
      uid: `vbv_checker_orders-${o.id}`,
      id: o.id,
      sourceTable: "vbv_checker_orders",
      user: o.client_handle || "@guest_user",
      category: "3DS [VBV] checker",
      isChecker: true,
      maskedDetails: `3DS VBV - ${maskCard(o.card_number)}`,
      fullDetails: [
        `Check Type: 3DS [VBV] checker`,
        `Card Number: ${o.card_number}`,
        `Fee: $${Number(o.fee ?? 0.99).toFixed(2)}`
      ].join("\n"),
      price: Number(o.fee ?? 0.99),
      date: formatTimestamp(o.created_at),
      rawDate: o.created_at,
      status: o.status || "pending"
    });
  });

  (balRes.data || []).forEach((o) => {
    normalized.push({
      uid: `balance_checker_orders-${o.id}`,
      id: o.id,
      sourceTable: "balance_checker_orders",
      user: o.client_handle || "@guest_user",
      category: "Balance checker",
      isChecker: true,
      maskedDetails: `Balance - ${maskCard(o.card_number)} ($${Number(o.check_amount).toFixed(2)})`,
      fullDetails: [
        `Check Type: Balance checker`,
        `Card Number: ${o.card_number}`,
        `Expiration: ${o.exp_month}/${o.exp_year}`,
        `CVV: ${o.cvv || "Optional / None"}`,
        `Check Amount: $${Number(o.check_amount).toFixed(2)}`,
        `Fee: $${Number(o.fee ?? 0.99).toFixed(2)}`
      ].join("\n"),
      price: Number(o.fee ?? 0.99),
      date: formatTimestamp(o.created_at),
      rawDate: o.created_at,
      status: o.status || "pending"
    });
  });

  normalized.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
  return { normalized, delivMap };
};

export default function Orders() {
  const [activeTab, setActiveTab] = useState("all");
  const [orders, setOrders] = useState([]);
  const [deliveriesByKey, setDeliveriesByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [deletingUid, setDeletingUid] = useState(null);

  const [viewingOrder, setViewingOrder] = useState(null);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);

  const fetchAllOrders = useCallback(async () => {
    try {
      const { normalized, delivMap } = await loadOrdersData();
      setDeliveriesByKey(delivMap);
      setOrders(normalized);
    } catch (err) {
      console.error("Unexpected error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runInitialLoad = async () => {
      try {
        const { normalized, delivMap } = await loadOrdersData();
        if (cancelled) return;
        setDeliveriesByKey(delivMap);
        setOrders(normalized);
      } catch (err) {
        if (!cancelled) {
          console.error("Unexpected error fetching orders:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    runInitialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenDeliver = (e, order) => {
    e.stopPropagation();
    const existingDelivery = deliveriesByKey[`${order.sourceTable}:${order.id}`];
    setDeliveryModalOrder(order);
    setSubject(
      existingDelivery?.subject || `Your Order #${order.id} (${order.category}) Delivery`
    );
    setMessage(
      existingDelivery?.response_message ||
        `Hello ${order.user},\n\nHere is the response / delivery for ${order.category} (#${order.id}):\n\n${order.fullDetails}\n\nResult / Status: `
    );
  };

  const handleSendDelivery = async (e) => {
    e.preventDefault();
    if (!deliveryModalOrder || savingDelivery) return;

    setSavingDelivery(true);
    try {
      const { error: delivError } = await supabase
        .from("order_deliveries")
        .insert([
          {
            source_table: deliveryModalOrder.sourceTable,
            source_order_id: deliveryModalOrder.id,
            category: deliveryModalOrder.category,
            client_handle: deliveryModalOrder.user,
            subject: subject.trim(),
            response_message: message.trim()
          }
        ]);

      if (delivError) {
        alert("Failed to save delivery response: " + delivError.message);
        return;
      }

      const { error: statusError } = await supabase
        .from(deliveryModalOrder.sourceTable)
        .update({ status: "delivered" })
        .eq("id", deliveryModalOrder.id);

      if (statusError) {
        alert("Delivery saved, but failed to update order status: " + statusError.message);
      }

      await fetchAllOrders();
      alert(`Delivery saved for Order #${deliveryModalOrder.id} (${deliveryModalOrder.category})!`);
      setDeliveryModalOrder(null);
      setSubject("");
      setMessage("");
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleDeleteDeliveredOrder = async (e, order) => {
    e.stopPropagation();
    if (deletingUid) return;

    setDeletingUid(order.uid);
    try {
      const { error: delivDelError } = await supabase
        .from("order_deliveries")
        .delete()
        .eq("source_table", order.sourceTable)
        .eq("source_order_id", order.id);

      if (delivDelError) {
        console.warn("Could not delete linked order_deliveries record:", delivDelError.message);
      }

      const { error: orderDelError } = await supabase
        .from(order.sourceTable)
        .delete()
        .eq("id", order.id);

      if (orderDelError) {
        alert("Failed to delete delivered order: " + orderDelError.message);
        return;
      }

      setOrders((prev) => prev.filter((item) => item.uid !== order.uid));
      if (viewingOrder?.uid === order.uid) {
        setViewingOrder(null);
      }
    } finally {
      setDeletingUid(null);
    }
  };

  const isDeliveredTab = activeTab === "delivered";

  const filteredOrders = orders.filter((o) => {
    if (isDeliveredTab) return o.status === "delivered";
    if (o.status === "delivered") return false;
    if (activeTab === "all") return true;
    if (activeTab === "pending") return o.status === "pending";
    if (activeTab === "cvv") return o.category === "CVV";
    if (activeTab === "novbv") return o.category === "Novbv";
    if (activeTab === "dumps") return o.category === "Dumps";
    if (activeTab === "checker") return o.isChecker;
    return true;
  });

  return (
    <div className="orders-container">
      <h2 className="orders-header">Client Orders &amp; Deliveries</h2>

      <div className="orders-tabs">
        <button
          type="button"
          className={`orders-tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Orders
        </button>
        <button
          type="button"
          className={`orders-tab-btn ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Delivery
        </button>
        <button
          type="button"
          className={`orders-tab-btn ${activeTab === "delivered" ? "active" : ""}`}
          onClick={() => setActiveTab("delivered")}
        >
          Delivered
        </button>
        <button
          type="button"
          className={`orders-tab-btn ${activeTab === "cvv" ? "active" : ""}`}
          onClick={() => setActiveTab("cvv")}
        >
          CVV
        </button>
        <button
          type="button"
          className={`orders-tab-btn ${activeTab === "novbv" ? "active" : ""}`}
          onClick={() => setActiveTab("novbv")}
        >
          Novbv
        </button>
        <button
          type="button"
          className={`orders-tab-btn ${activeTab === "dumps" ? "active" : ""}`}
          onClick={() => setActiveTab("dumps")}
        >
          Dumps
        </button>
        <button
          type="button"
          className={`orders-tab-btn ${activeTab === "checker" ? "active" : ""}`}
          onClick={() => setActiveTab("checker")}
        >
          Checkers
        </button>
      </div>

      <div className="orders-table-section">
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Client</th>
                <th>Category</th>
                <th>Item Details (Masked)</th>
                <th>Price</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="orders-empty-row">
                    Loading orders from database...
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((o) => (
                  <tr
                    key={o.uid}
                    onClick={() => setViewingOrder(o)}
                    style={{ cursor: "pointer" }}
                    title="Click to view full buyer details"
                  >
                    <td>#{o.id}</td>
                    <td>{o.user}</td>
                    <td><strong>{o.category}</strong></td>
                    <td>{o.maskedDetails}</td>
                    <td><strong>${Number(o.price).toFixed(2)}</strong></td>
                    <td>{o.date}</td>
                    <td>
                      <span className={`orders-status-badge ${o.status}`}>
                        {o.status}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {isDeliveredTab ? (
                        <button
                          type="button"
                          className="orders-btn-delete"
                          disabled={deletingUid === o.uid}
                          onClick={(e) => handleDeleteDeliveredOrder(e, o)}
                        >
                          {deletingUid === o.uid ? "Deleting..." : "Delete"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="orders-btn-deliver"
                          onClick={(e) => handleOpenDeliver(e, o)}
                        >
                          Deliver
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="orders-empty-row">
                    No orders found in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingOrder && (
        <div className="orders-modal-overlay" onClick={() => setViewingOrder(null)}>
          <div className="orders-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="orders-modal-header">
              <h3 className="orders-modal-title">
                Buyer Data for #{viewingOrder.id} ({viewingOrder.category})
              </h3>
              <button
                type="button"
                className="orders-close-btn"
                onClick={() => setViewingOrder(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <div className="orders-modal-body">
              <div className="orders-form-group">
                <label>Client Account</label>
                <div
                  style={{
                    padding: "10px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1"
                  }}
                >
                  <strong>{viewingOrder.user}</strong> ({viewingOrder.category}) — {viewingOrder.date}
                </div>
              </div>

              <div className="orders-form-group">
                <label>Complete Data Submitted / Requested by Buyer</label>
                <textarea
                  readOnly
                  value={viewingOrder.fullDetails}
                  style={{
                    backgroundColor: "#f1f5f9",
                    cursor: "default",
                    fontFamily: "monospace"
                  }}
                />
              </div>

              {deliveriesByKey[`${viewingOrder.sourceTable}:${viewingOrder.id}`] && (
                <div className="orders-form-group">
                  <label>Latest Saved Delivery Response</label>
                  <textarea
                    readOnly
                    value={
                      deliveriesByKey[`${viewingOrder.sourceTable}:${viewingOrder.id}`]
                        .response_message
                    }
                    style={{
                      backgroundColor: "#ecfdf5",
                      cursor: "default",
                      fontFamily: "monospace"
                    }}
                  />
                </div>
              )}

              <div className="orders-modal-footer">
                {viewingOrder.status !== "delivered" && (
                  <button
                    type="button"
                    className="orders-btn-submit"
                    onClick={() => {
                      const orderToDeliver = viewingOrder;
                      setViewingOrder(null);
                      handleOpenDeliver({ stopPropagation: () => {} }, orderToDeliver);
                    }}
                  >
                    Proceed to Deliver
                  </button>
                )}
                <button
                  type="button"
                  className="orders-btn-cancel"
                  onClick={() => setViewingOrder(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deliveryModalOrder && (
        <div className="orders-modal-overlay" onClick={() => setDeliveryModalOrder(null)}>
          <div className="orders-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="orders-modal-header">
              <h3 className="orders-modal-title">
                Deliver #{deliveryModalOrder.id} ({deliveryModalOrder.category}) to{" "}
                {deliveryModalOrder.user}
              </h3>
              <button
                type="button"
                className="orders-close-btn"
                onClick={() => setDeliveryModalOrder(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendDelivery} className="orders-modal-body">
              <div className="orders-form-group">
                <label htmlFor="deliverySubject">Subject</label>
                <input
                  id="deliverySubject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="orders-form-group">
                <label htmlFor="deliveryMessage">
                  Message / Checker Result / Item Credentials
                </label>
                <textarea
                  id="deliveryMessage"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              <div className="orders-modal-footer">
                <button
                  type="submit"
                  className="orders-btn-submit"
                  disabled={savingDelivery}
                >
                  {savingDelivery ? "Saving..." : "Confirm & Send Delivery"}
                </button>
                <button
                  type="button"
                  className="orders-btn-cancel"
                  onClick={() => setDeliveryModalOrder(null)}
                  disabled={savingDelivery}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}