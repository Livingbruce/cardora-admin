import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../utils/supabase";
import "../../styles/dashboard/Tickets.css";

const formatTicketDate = (iso) => {
  if (!iso) return "N/A";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toISOString().slice(0, 16).replace("T", " ");
};

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch tickets from Supabase
  const fetchTickets = useCallback(async (isMounted = () => true) => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((row) => {
        const rawType = (
          row.ticket_type ||
          row.type ||
          "support"
        ).toLowerCase();

        const displayType =
          rawType === "refund" ? "Refund" : "Support";

        const displayUser =
          row.client_handle ||
          (row.username
            ? row.username.startsWith("@")
              ? row.username
              : `@${row.username}`
            : "@guest_user");

        return {
          id: row.id,
          user: displayUser,
          subject:
            row.subject ||
            (displayType === "Refund"
              ? "Refund Request"
              : "Support Ticket"),
          type: displayType,
          date: formatTicketDate(row.created_at),
          status: row.status || "open",
          message: row.message || "",
          orderReference: row.order_reference || null,
          adminReply: row.admin_reply || "",
        };
      });

      if (isMounted()) {
        setTickets(normalized);
      }
    } catch (err) {
      console.error(
        "Error fetching tickets from database:",
        err.message
      );
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, []);

  // Initial loading
  useEffect(() => {
    let isMounted = true;

    const initializeTickets = async () => {
      await fetchTickets(() => isMounted);
    };

    initializeTickets();

    return () => {
      isMounted = false;
    };
  }, [fetchTickets]);

  // Select ticket
  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setReplyText(ticket.adminReply || "");
  };

  // Resolve ticket
  const handleResolve = async (id) => {
    if (saving) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          status: "resolved",
          admin_reply: replyText.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        alert("Failed to mark ticket resolved: " + error.message);
        return;
      }

      await fetchTickets();

      setSelectedTicket(null);
      setReplyText("");
    } catch (err) {
      console.error("Error resolving ticket:", err);
      alert("An unexpected error occurred while resolving the ticket.");
    } finally {
      setSaving(false);
    }
  };

  // Send admin reply
  const handleSendReply = async (e) => {
    e.preventDefault();

    if (!selectedTicket || !replyText.trim() || saving) return;

    setSaving(true);

    try {
      const reply = replyText.trim();

      const { error } = await supabase
        .from("tickets")
        .update({
          admin_reply: reply,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTicket.id);

      if (error) {
        alert("Failed to save reply: " + error.message);
        return;
      }

      await fetchTickets();

      alert(`Reply saved for ${selectedTicket.user}: "${reply}"`);

      setReplyText("");
      setSelectedTicket(null);
    } catch (err) {
      console.error("Error sending ticket reply:", err);
      alert("An unexpected error occurred while sending the reply.");
    } finally {
      setSaving(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    if (saving) return;

    setSelectedTicket(null);
    setReplyText("");
  };

  return (
    <div className="tickets-container">
      <h2 className="tickets-header">
        Buyer Tickets &amp; Refund Requests
      </h2>

      {/* Tickets Table */}
      <div className="tickets-table-section">
        <div className="tickets-table-wrapper">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>User</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="tickets-empty-row">
                    Loading tickets from database...
                  </td>
                </tr>
              ) : tickets.length > 0 ? (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => handleSelectTicket(t)}
                  >
                    <td>#TCK-{t.id}</td>
                    <td>{t.user}</td>
                    <td>
                      <strong>{t.type}</strong>
                    </td>
                    <td>{t.subject}</td>
                    <td>{t.date}</td>
                    <td>
                      <span
                        className={`tickets-status-badge ${t.status}`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="tickets-empty-row">
                    No tickets or refund requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div
          className="tickets-modal-overlay"
          onClick={handleCloseModal}
        >
          <div
            className="tickets-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tickets-modal-header">
              <h3 className="tickets-modal-title">
                Ticket Details #TCK-{selectedTicket.id}
              </h3>

              <button
                type="button"
                className="tickets-close-btn"
                onClick={handleCloseModal}
                aria-label="Close modal"
                disabled={saving}
              >
                &times;
              </button>
            </div>

            <div className="tickets-modal-body">
              {/* User and Subject */}
              <div className="tickets-detail-group">
                <label>User / Subject</label>

                <div className="tickets-detail-box">
                  <strong>{selectedTicket.user}</strong> —{" "}
                  {selectedTicket.subject} ({selectedTicket.type})

                  {selectedTicket.orderReference
                    ? ` • Ref: ${selectedTicket.orderReference}`
                    : ""}
                </div>
              </div>

              {/* Buyer Message */}
              <div className="tickets-detail-group">
                <label>Buyer Message</label>

                <div
                  className="tickets-detail-box"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {selectedTicket.message}
                </div>
              </div>

              {/* Admin Reply */}
              <div className="tickets-detail-group">
                <label htmlFor="replyInput">
                  Admin Reply / Resolution Note
                </label>

                <textarea
                  id="replyInput"
                  className="tickets-reply-textarea"
                  placeholder="Type your response to the buyer here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Modal Actions */}
              <div className="tickets-modal-footer">
                {selectedTicket.status === "open" && (
                  <button
                    type="button"
                    className="tickets-btn-resolve"
                    onClick={() =>
                      handleResolve(selectedTicket.id)
                    }
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Mark Resolved"}
                  </button>
                )}

                <button
                  type="button"
                  className="tickets-btn-submit"
                  onClick={handleSendReply}
                  disabled={saving || !replyText.trim()}
                >
                  {saving ? "Saving..." : "Send Reply"}
                </button>

                <button
                  type="button"
                  className="tickets-btn-close"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
