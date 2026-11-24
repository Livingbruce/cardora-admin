import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabase";
import "../../styles/dashboard/Payments.css";

const formatPaymentDate = (iso) => {
  if (!iso) return "N/A";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toISOString().slice(0, 16).replace("T", " ");
};

const extractErrorMessage = (err, fallback = "Unexpected error occurred.") => {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  return err.message || err.details || err.hint || fallback;
};

export default function Payments() {
  const [activeTab, setActiveTab] = useState("pending");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [copiedTxId, setCopiedTxId] = useState(false);
  const [actionError, setActionError] = useState("");

  // Fetch payments
  const fetchPayments = useCallback(async (isMounted = () => true) => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((row) => ({
        id: row.id,
        clientUid: row.client_uid,
        txRef: row.order_reference || `TXN-${row.id}`,
        txHash: row.tx_hash || "",
        walletAddress: row.wallet_address || "N/A",
        provider: row.provider || "Binance",
        network: row.network || "N/A",
        user:
          row.client_handle ||
          (row.username
            ? row.username.startsWith("@")
              ? row.username
              : `@${row.username}`
            : "@guest_user"),
        method: row.network
          ? `${row.provider || "Binance"} (${row.network})`
          : row.provider || "Binance",
        amount: Number(row.package_amount ?? row.amount ?? 0),
        date: formatPaymentDate(row.created_at),
        approvedAt: row.approved_at
          ? formatPaymentDate(row.approved_at)
          : null,
        status: row.status || "pending",
      }));

      if (isMounted()) {
        setPayments(normalized);
        setActionError("");
      }
    } catch (err) {
      const msg = extractErrorMessage(err, "Failed to load payments.");
      console.error("Error fetching payments:", msg);
      if (isMounted()) {
        setActionError(msg);
      }
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, []);

  // Initial payment loading
  useEffect(() => {
    let isMounted = true;

    const initializePayments = async () => {
      await fetchPayments(() => isMounted);
    };

    initializePayments();

    return () => {
      isMounted = false;
    };
  }, [fetchPayments]);

  // Open payment details
  const handleOpenPaymentPrompt = (payment) => {
    setCopiedTxId(false);
    setActionError("");
    setSelectedPayment(payment);
  };

  // Close payment details
  const handleClosePrompt = () => {
    if (processingId) return;

    setCopiedTxId(false);
    setActionError("");
    setSelectedPayment(null);
  };

  // Get transaction ID
  const getHighlightedTxId = (payment) => {
    if (!payment) return "";

    return payment.txHash || payment.txRef;
  };

  // Copy transaction ID
  const handleCopyTxId = async (payment) => {
    const valueToCopy = getHighlightedTxId(payment);

    if (!valueToCopy) return;

    try {
      await navigator.clipboard.writeText(valueToCopy);

      setCopiedTxId(true);

      setTimeout(() => setCopiedTxId(false), 2000);
    } catch {
      alert("Transaction ID: " + valueToCopy);
    }
  };

  const rollbackPaymentToPending = async (paymentId) => {
    try {
      await supabase
        .from("payments")
        .update({ status: "pending", approved_at: null })
        .eq("id", paymentId)
        .eq("status", "approved");
    } catch (rollbackErr) {
      console.error("Rollback failed for payment", paymentId, rollbackErr);
    }
  };

  // Approve or cancel payment
  const handleAction = async (payment, newStatus) => {
    if (processingId || !payment) return;

    setProcessingId(payment.id);
    setActionError("");

    try {
      if (newStatus === "cancelled") {
        const { data: cancelledRow, error: cancelError } = await supabase
          .from("payments")
          .update({ status: "cancelled" })
          .eq("id", payment.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

        if (cancelError) {
          const msg = extractErrorMessage(cancelError, "Failed to cancel payment.");
          setActionError(msg);
          alert("Failed to cancel payment: " + msg);
          return;
        }

        if (!cancelledRow) {
          const msg = "Payment is no longer pending or could not be updated.";
          setActionError(msg);
          alert(msg);
          await fetchPayments();
          return;
        }

        await fetchPayments();
        window.dispatchEvent(new Event("cardora:payment-updated"));
        setSelectedPayment(null);
        return;
      }

      if (newStatus === "approved") {
        const creditAmount = Number(payment.amount ?? 0);

        if (!payment.clientUid) {
          const msg = "Cannot approve payment: missing client_uid on payment record.";
          setActionError(msg);
          alert(msg);
          return;
        }

        if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
          const msg = "Cannot approve payment: invalid payment amount.";
          setActionError(msg);
          alert(msg);
          return;
        }

        // 1. Attempt atomic RPC approval + balance credit if available
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "approve_payment_and_credit_balance",
          {
            p_payment_id: payment.id,
            p_credit_amount: Number(creditAmount.toFixed(2)),
          }
        );

        const rpcMissing =
          rpcError &&
          (rpcError.code === "PGRST202" ||
            /function .* does not exist/i.test(rpcError.message || ""));

        if (!rpcMissing) {
          if (rpcError) {
            const msg = extractErrorMessage(
              rpcError,
              "Approval blocked because balance update failed."
            );
            setActionError(msg);
            alert("Approval aborted: " + msg);
            return;
          }

          const rpcResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const nextBalance = Number(rpcResult?.new_balance ?? creditAmount);

          await fetchPayments();
          window.dispatchEvent(new Event("cardora:payment-updated"));
          setSelectedPayment(null);
          alert(
            `Approved $${creditAmount.toFixed(2)} for ${payment.user}. Updated balance: $${nextBalance.toFixed(2)}`
          );
          return;
        }

        // 2. Fallback flow with strict pre-check and automatic rollback on failure
        const { data: profile, error: profileFetchError } = await supabase
          .from("profiles")
          .select("uid, balance")
          .eq("uid", payment.clientUid)
          .maybeSingle();

        if (profileFetchError) {
          const msg = extractErrorMessage(
            profileFetchError,
            "Could not load client profile before approving payment."
          );
          setActionError(msg);
          alert("Approval aborted: " + msg);
          return;
        }

        if (!profile) {
          const msg = `Client profile not found for UID (${payment.clientUid}). Payment was NOT approved.`;
          setActionError(msg);
          alert(msg);
          return;
        }

        const approvedTimestamp = new Date().toISOString();
        const { data: updatedPayment, error: approveError } = await supabase
          .from("payments")
          .update({
            status: "approved",
            approved_at: approvedTimestamp,
          })
          .eq("id", payment.id)
          .eq("status", "pending")
          .select("id, client_uid, package_amount")
          .maybeSingle();

        if (approveError) {
          const msg = extractErrorMessage(
            approveError,
            "Failed to mark payment approved."
          );
          setActionError(msg);
          alert("Approval aborted: " + msg);
          return;
        }

        if (!updatedPayment) {
          const msg = "This payment was already processed or is no longer pending.";
          setActionError(msg);
          alert(msg);
          await fetchPayments();
          setSelectedPayment(null);
          return;
        }

        const resolvedAmount = Number(
          updatedPayment.package_amount ?? creditAmount
        );
        const currentBalance = Number(profile.balance ?? 0);
        const nextBalance = Number((currentBalance + resolvedAmount).toFixed(2));

        const { data: updatedProfile, error: balanceError } = await supabase
          .from("profiles")
          .update({ balance: nextBalance })
          .eq("uid", updatedPayment.client_uid)
          .select("uid, balance")
          .maybeSingle();

        if (balanceError || !updatedProfile) {
          await rollbackPaymentToPending(updatedPayment.id);
          const msg = balanceError
            ? extractErrorMessage(
                balanceError,
                "Failed to update client balance; approval was rolled back."
              )
            : "Client balance row was not updated; approval was rolled back.";

          setActionError(msg);
          await fetchPayments();
          alert("Approval failed — payment reverted to pending: " + msg);
          return;
        }

        const { data: verifiedProfile, error: verifyError } = await supabase
          .from("profiles")
          .select("balance")
          .eq("uid", updatedPayment.client_uid)
          .maybeSingle();

        if (verifyError || !verifiedProfile) {
          await rollbackPaymentToPending(updatedPayment.id);
          const msg = extractErrorMessage(
            verifyError,
            "Could not verify updated client balance; approval was rolled back."
          );
          setActionError(msg);
          await fetchPayments();
          alert("Approval failed — payment reverted to pending: " + msg);
          return;
        }

        const actualBalance = Number(verifiedProfile.balance ?? nextBalance);

        await fetchPayments();
        window.dispatchEvent(new Event("cardora:payment-updated"));
        setSelectedPayment(null);
        alert(
          `Approved $${resolvedAmount.toFixed(2)} for ${payment.user}. Updated balance: $${actualBalance.toFixed(2)}`
        );
      }
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "A critical error occurred while processing payment."
      );
      console.error("Critical payment action error:", err);
      setActionError(msg);
      alert("Critical error: " + msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Filter payments by active tab
  const filteredPayments = payments.filter(
    (p) => p.status === activeTab
  );

  return (
    <div className="payments-container">
      <h2 className="payments-header">Manage Payments</h2>

      {actionError && !selectedPayment && (
        <div
          role="alert"
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "14px",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {actionError}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="payments-tabs">
        <button
          type="button"
          className={`payments-tab-btn ${
            activeTab === "pending" ? "active" : ""
          }`}
          onClick={() => setActiveTab("pending")}
        >
          Pending ({payments.filter((p) => p.status === "pending").length})
        </button>

        <button
          type="button"
          className={`payments-tab-btn ${
            activeTab === "approved" ? "active" : ""
          }`}
          onClick={() => setActiveTab("approved")}
        >
          Approved ({payments.filter((p) => p.status === "approved").length})
        </button>

        <button
          type="button"
          className={`payments-tab-btn ${
            activeTab === "cancelled" ? "active" : ""
          }`}
          onClick={() => setActiveTab("cancelled")}
        >
          Cancelled ({payments.filter((p) => p.status === "cancelled").length})
        </button>
      </div>

      {/* Payments Table */}
      <div className="payments-table-section">
        <div className="payments-table-wrapper">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>User</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                {activeTab === "pending" && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={activeTab === "pending" ? 7 : 6}
                    className="payments-empty-row"
                  >
                    Loading payments from database...
                  </td>
                </tr>
              ) : filteredPayments.length > 0 ? (
                filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleOpenPaymentPrompt(p)}
                  >
                    <td>
                      <code>{p.txHash || p.txRef}</code>
                    </td>

                    <td>{p.user}</td>
                    <td>{p.method}</td>

                    <td>
                      <strong>${Number(p.amount).toFixed(2)}</strong>
                    </td>

                    <td>{p.date}</td>

                    <td>
                      <span
                        className={`payments-status-badge ${p.status}`}
                      >
                        {p.status}
                      </span>
                    </td>

                    {activeTab === "pending" && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="payments-action-group">
                          <button
                            type="button"
                            className="payments-btn-approve"
                            disabled={processingId === p.id}
                            onClick={() =>
                              handleAction(p, "approved")
                            }
                          >
                            {processingId === p.id
                              ? "Processing..."
                              : "Approve"}
                          </button>

                          <button
                            type="button"
                            className="payments-btn-cancel"
                            disabled={processingId === p.id}
                            onClick={() =>
                              handleAction(p, "cancelled")
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={activeTab === "pending" ? 7 : 6}
                    className="payments-empty-row"
                  >
                    No {activeTab} payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div
          onClick={handleClosePrompt}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "540px",
              backgroundColor: "#ffffff",
              color: "#0f172a",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.3)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: "1.25rem",
                color: "#0f172a",
              }}
            >
              Payment Details — #{selectedPayment.id}
            </h3>

            {actionError && (
              <div
                role="alert"
                style={{
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #fca5a5",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                }}
              >
                {actionError}
              </div>
            )}

            {/* Transaction ID */}
            <div
              style={{
                backgroundColor: "#fef9c3",
                border: "2px solid #eab308",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#854d0e",
                  marginBottom: "6px",
                }}
              >
                Transaction ID / Hash
              </div>

              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  wordBreak: "break-all",
                  marginBottom: "10px",
                }}
              >
                {getHighlightedTxId(selectedPayment)}
              </div>

              <button
                type="button"
                onClick={() => handleCopyTxId(selectedPayment)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "7px",
                  border: "none",
                  backgroundColor: "#0f172a",
                  color: "#facc15",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {copiedTxId
                  ? "Copied Transaction ID!"
                  : "Copy Transaction ID"}
              </button>
            </div>

            {/* Payment Details */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "0.92rem",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#64748b" }}>Order Reference:</span>
                <strong>{selectedPayment.txRef}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#64748b" }}>User:</span>
                <strong>{selectedPayment.user}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#64748b" }}>Client UID:</span>
                <code style={{ fontSize: "0.82rem" }}>
                  {selectedPayment.clientUid || "N/A"}
                </code>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#64748b" }}>Provider / Method:</span>
                <strong>{selectedPayment.method}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#64748b" }}>Amount:</span>
                <strong>
                  ${Number(selectedPayment.amount).toFixed(2)} USDT
                </strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#64748b" }}>Status:</span>
                <span
                  className={`payments-status-badge ${selectedPayment.status}`}
                >
                  {selectedPayment.status}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#64748b" }}>Submitted Date:</span>
                <strong>{selectedPayment.date}</strong>
              </div>

              {selectedPayment.approvedAt && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ color: "#64748b" }}>Approved Date:</span>
                  <strong>{selectedPayment.approvedAt}</strong>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span style={{ color: "#64748b" }}>
                  Receiving Wallet Address:
                </span>

                <code
                  style={{
                    fontSize: "0.82rem",
                    wordBreak: "break-all",
                  }}
                >
                  {selectedPayment.walletAddress}
                </code>
              </div>
            </div>

            {/* Approve and Cancel */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="payments-btn-approve"
                disabled={
                  processingId === selectedPayment.id ||
                  selectedPayment.status !== "pending"
                }
                onClick={() =>
                  handleAction(selectedPayment, "approved")
                }
              >
                {processingId === selectedPayment.id
                  ? "Processing..."
                  : "Approve"}
              </button>

              <button
                type="button"
                className="payments-btn-cancel"
                disabled={
                  processingId === selectedPayment.id ||
                  selectedPayment.status !== "pending"
                }
                onClick={() =>
                  handleAction(selectedPayment, "cancelled")
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}