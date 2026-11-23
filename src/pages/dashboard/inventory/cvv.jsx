import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../../utils/supabase";
import { banks, bins, zipCode } from "../../../components/countrys";
import "../../../styles/dashboard/inventory/cvv.css";

const normalizeCvvRow = (row) => ({
  id: row.id,
  bin: row.bin || "",
  bank: row.bank || "",
  cardType: row.card_type ?? row.cardType ?? "credit",
  cardLevel: row.card_level ?? row.cardLevel ?? "atm card",
  expiry: row.expiry || "",
  country: row.country || "",
  state: row.state || "",
  city: row.city || "",
  zip: row.zip || "",
  fname: row.fname || "",
  address: Boolean(row.address),
  phone: Boolean(row.phone),
  email: Boolean(row.email),
  fullz: Boolean(row.fullz),
  reference: Boolean(row.reference),
  price: Number(row.price ?? 0)
});

export default function Cvv() {
  const [cvvList, setCvvList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form input states
  const [bin, setBin] = useState("");
  const [bank, setBank] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [zipSearch, setZipSearch] = useState("");
  const [binSearch, setBinSearch] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [zipDropdownOpen, setZipDropdownOpen] = useState(false);
  const [binDropdownOpen, setBinDropdownOpen] = useState(false);
  const [cardType, setCardType] = useState("");
  const [cardLevel, setCardLevel] = useState("");
  const [expiry, setExpiry] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [fname, setFname] = useState("");

  // Checkbox flags
  const [address, setAddress] = useState(false);
  const [phone, setPhone] = useState(false);
  const [email, setEmail] = useState(false);
  const [fullz, setFullz] = useState(false);
  const [reference, setReference] = useState(false);

  const [price, setPrice] = useState("");

  const bankDropdownRef = useRef(null);
  const zipDropdownRef = useRef(null);
  const binDropdownRef = useRef(null);
  const bankSearchInputRef = useRef(null);
  const zipSearchInputRef = useRef(null);
  const binSearchInputRef = useRef(null);

  const sortedBank = useMemo(() => {
    if (!Array.isArray(banks)) return [];
    return [...banks].sort((a, b) => a.localeCompare(b));
  }, []);

  const sortedBin = useMemo(() => {
    if (!Array.isArray(bins)) return [];
    return [...bins].sort((a, b) => a.localeCompare(b));
  }, []);

  const sortedZip = useMemo(() => {
    if (!Array.isArray(zipCode)) return [];
    return [...zipCode].sort((a, b) => a.localeCompare(b));
  }, []);

  const filteredBanks = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    const matches = query
      ? sortedBank.filter((item) => item.toLowerCase().includes(query))
      : sortedBank;

    if (bank && !matches.includes(bank)) {
      return [bank, ...matches];
    }
    return matches;
  }, [sortedBank, bankSearch, bank]);

  const filteredZip = useMemo(() => {
    const query = zipSearch.trim().toLocaleLowerCase();
    const matches = query
      ? sortedZip.filter((item) => item.toLowerCase().includes(query))
      : sortedZip

    if (zip && !matches.includes(zip)) {
      return [zip, ...matches];
    }
    return matches;
  }, [sortedZip, zipSearch, zip]);

  const filteredBin = useMemo(() => {
    const query = binSearch.trim().toLowerCase();
    const matches = query
      ? sortedBin.filter((item) => item.toLowerCase().includes(query))
      : sortedBin

    if (bin && !matches.includes(bin)) {
      return [bin, ...matches];
    }
    return matches;
  }, [sortedBin, binSearch, bin]);

  const fetchCvvStock = useCallback(async (isMounted = () => true) => {
    try {
      const { data, error } = await supabase
        .from("cvv_stock")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      if (isMounted()) {
        setCvvList((data || []).map(normalizeCvvRow));
      }
    } catch (err) {
      console.error("Error fetching CVV stock:", err.message || err);
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStock = async () => {
      try {
        const { data, error } = await supabase
          .from("cvv_stock")
          .select("*")
          .order("id", { ascending: false });

        if (error) throw error;

        if (!cancelled) {
          setCvvList((data || []).map(normalizeCvvRow));
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching CVV stock:", err.message || err);

        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadStock();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bankDropdownOpen) return;

    const handleOutsideClick = (e) => {
      if (
        bankDropdownRef.current &&
        !bankDropdownRef.current.contains(e.target)
      ) {
        setBankDropdownOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setBankDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    const focusTimer = setTimeout(() => {
      bankSearchInputRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [bankDropdownOpen]);

  useEffect(() => {
    if (!zipDropdownOpen) return;

    const handleOutsideClick = (e) => {
      if (
        zipDropdownRef.current &&
        !zipDropdownRef.current.contains(e.target)
      ) {
        setZipDropdownOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setZipDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    const focusTimer = setTimeout(() => {
      zipSearchInputRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [zipDropdownOpen]);

  useEffect(() => {
    if (!binDropdownOpen) return;

    const handleOutsideClick = (e) => {
      if (
        binDropdownRef.current &&
        !binDropdownRef.current.contains(e.target)
      ) {
        setBinDropdownOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setBinDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    const focusTimer = setTimeout(() => {
      binSearchInputRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [binDropdownOpen]);

  const resetForm = () => {
    setEditingId(null);
    setBin("");
    setBank("");
    setBankSearch("");
    setBankDropdownOpen(false);
    setCardType("");
    setCardLevel("");
    setExpiry("");
    setCountry("");
    setState("");
    setCity("");
    setZip("");
    setFname("");
    setAddress(false);
    setPhone(false);
    setEmail(false);
    setFullz(false);
    setReference(false);
    setPrice("");
  };

  const handleSelectRow = (item) => {
    setEditingId(item.id);
    setBin(item.bin);
    setBank(item.bank);
    setBankSearch("");
    setBankDropdownOpen(false);
    setCardType(item.cardType);
    setCardLevel(item.cardLevel);
    setExpiry(item.expiry);
    setCountry(item.country);
    setState(item.state);
    setCity(item.city);
    setZip(item.zip);
    setFname(item.fname);
    setAddress(item.address);
    setPhone(item.phone);
    setEmail(item.email);
    setFullz(item.fullz);
    setReference(item.reference);
    setPrice(String(item.price));
  };

  const handleExpireChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);

    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    setExpiry(value);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    const parsedPrice = parseFloat(price);
    if (!bin.trim() || !bank.trim() || Number.isNaN(parsedPrice)) {
      alert("Please fill in the required fields (Bin, Bank, Price).");
      return;
    }

    setSaving(true);

    const payload = {
      bin: bin.trim(),
      bank: bank.trim(),
      card_type: cardType,
      card_level: cardLevel,
      expiry: expiry.trim() || null,
      country: country.trim() || null,
      state: state.trim() || null,
      city: city.trim() || null,
      zip: zip.trim() || null,
      fname: fname.trim() || null,
      address,
      phone,
      email,
      fullz,
      reference,
      price: parsedPrice,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("cvv_stock")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          alert("Error updating CVV stock: " + error.message);
          return;
        }

        await fetchCvvStock();
        window.dispatchEvent(new Event("cardora:stock-updated"));
        alert("CVV stock item updated successfully!");
        resetForm();
      } else {
        const { error } = await supabase
          .from("cvv_stock")
          .insert([{ ...payload, status: "available" }]);

        if (error) {
          alert("Error adding CVV stock: " + error.message);
          return;
        }

        await fetchCvvStock();
        window.dispatchEvent(new Event("cardora:stock-updated"));
        alert("New CVV stock item added successfully!");
        resetForm();
      }
    } catch (err) {
      console.error("Unexpected CVV save error:", err);
      alert("An unexpected error occurred while saving CVV stock.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || saving) return;
    if (!window.confirm("Are you sure you want to delete this CVV stock item?")) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("cvv_stock")
        .delete()
        .eq("id", editingId);

      if (error) {
        alert("Error deleting CVV stock: " + error.message);
        return;
      }

      await fetchCvvStock();
      window.dispatchEvent(new Event("cardora:stock-updated"));
      resetForm();
    } catch (err) {
      console.error("Unexpected CVV delete error:", err);
      alert("An unexpected error occurred while deleting CVV stock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cvv-inventory-container">
      <h2 className="cvv-header">CVV Inventory Management</h2>

      <div className="cvv-form-card">
        <h3 className="cvv-form-title">
          {editingId
            ? `Editing CVV Item #STK-${editingId}`
            : "Upload New CVV Stock"}
        </h3>

        <form onSubmit={handleSave}>
          <div className="cvv-form-grid">
            <div className="cvv-form-group">
              <label htmlFor="bin">Bin Field</label>
              <div className="cvv-select-wrapper">
                <button
                  id="bin-trigger"
                  type="button"
                  className="cvv-select-trigger"
                  onClick={() => setBinDropdownOpen((prev) => !prev)}
                  aria-expanded={binDropdownOpen}
                >
                  <span className={bin ? "" : "cvv-select-placeholder"}>
                    {bin || "Select bin"}
                  </span>
                  <span className="cvv-select-arrow">
                    {binDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {binDropdownOpen && (
                  <div className="cvv-select-menu">
                    <div className="cvv-select-search-box">
                      <input
                        ref={binSearchInputRef}
                        type="text"
                        className="cvv-select-search-input"
                        placeholder="Search bin..."
                        value={binSearch}
                        onChange={(e) => setBinSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className="cvv-select-options">
                      {filteredBin.length > 0 ? (
                        filteredBin.map((item, index) => {
                          const isSelected = item === bin;
                          return (
                            <button
                              key={`${item}-${index}`}
                              type="button"
                              className={`cvv-select-option ${
                                isSelected ? "selected" : ""
                              }`}
                              onClick={() => {
                                setBin(item);
                                setBinSearch("");
                                setBinDropdownOpen(false);
                              }}
                            >
                              {item}
                            </button>
                          );
                        })
                      ) : (
                        <div className="cvv-select-no-results">
                          No matching bins found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="cvv-form-group" ref={bankDropdownRef}>
              <label htmlFor="bank-trigger">Bank</label>
              <div className="cvv-select-wrapper">
                <button
                  id="bank-trigger"
                  type="button"
                  className="cvv-select-trigger"
                  onClick={() => setBankDropdownOpen((prev) => !prev)}
                  aria-expanded={bankDropdownOpen}
                >
                  <span className={bank ? "" : "cvv-select-placeholder"}>
                    {bank || "Select a bank"}
                  </span>
                  <span className="cvv-select-arrow">
                    {bankDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {bankDropdownOpen && (
                  <div className="cvv-select-menu">
                    <div className="cvv-select-search-box">
                      <input
                        ref={bankSearchInputRef}
                        type="text"
                        className="cvv-select-search-input"
                        placeholder="Search bank..."
                        value={bankSearch}
                        onChange={(e) => setBankSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className="cvv-select-options">
                      {filteredBanks.length > 0 ? (
                        filteredBanks.map((item, index) => {
                          const isSelected = item === bank;
                          return (
                            <button
                              key={`${item}-${index}`}
                              type="button"
                              className={`cvv-select-option ${
                                isSelected ? "selected" : ""
                              }`}
                              onClick={() => {
                                setBank(item);
                                setBankSearch("");
                                setBankDropdownOpen(false);
                              }}
                            >
                              {item}
                            </button>
                          );
                        })
                      ) : (
                        <div className="cvv-select-no-results">
                          No matching banks found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="cvv-form-group">
              <label htmlFor="cardType">Card Type</label>
              <select
                id="cardType"
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
              >
                <option>Select Type</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
                <option value="charge card">Charge Card</option>
              </select>
            </div>

            <div className="cvv-form-group">
              <label htmlFor="cardLevel">Card Level</label>
              <select
                id="cardLevel"
                value={cardLevel}
                onChange={(e) => setCardLevel(e.target.value)}
              >
                <option>Select Level</option>
                <option value="atm card">ATM Card</option>
                <option value="B2B">B2B</option>
                <option value="black">Black</option>
                <option value="blue">Blue</option>
                <option value="business">Business</option>
                <option value="blue charge">Blue Charge</option>
              </select>
            </div>

            <div className="cvv-form-group">
              <label htmlFor="expiry">Expiry (MM/YY)</label>
              <input
                id="expiry"
                type="text"
                placeholder="MM/YY"
                value={expiry}
                onChange={handleExpireChange}
              />
            </div>

            <div className="cvv-form-group">
              <label htmlFor="country">Country</label>
              <input
                id="country"
                type="text"
                placeholder="e.g. US"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div className="cvv-form-group">
              <label htmlFor="state">State</label>
              <input
                id="state"
                type="text"
                placeholder="e.g. NY"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>

            <div className="cvv-form-group">
              <label htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                placeholder="e.g. New York"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="cvv-form-group">
              <label htmlFor="zip">Zip</label>
              <div className="cvv-select-wrapper">
                <button
                  id="zip-trigger"
                  type="button"
                  className="cvv-select-trigger"
                  onClick={() => setZipDropdownOpen((prev) => !prev)}
                  aria-expanded={zipDropdownOpen}
                >
                  <span className={zip ? "" : "cvv-select-placeholder"}>
                    {zip || "Select zip"}
                  </span>
                  <span className="cvv-select-arrow">
                    {zipDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {zipDropdownOpen && (
                  <div className="cvv-select-menu">
                    <div className="cvv-select-search-box">
                      <input
                        ref={zipSearchInputRef}
                        type="text"
                        className="cvv-select-search-input"
                        placeholder="Search zip..."
                        value={zipSearch}
                        onChange={(e) => setZipSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className="cvv-select-options">
                      {filteredZip.length > 0 ? (
                        filteredZip.map((item, index) => {
                          const isSelected = item === bank;
                          return (
                            <button
                              key={`${item}-${index}`}
                              type="button"
                              className={`cvv-select-option ${
                                isSelected ? "selected" : ""
                              }`}
                              onClick={() => {
                                setZip(item);
                                setZipSearch("");
                                setZipDropdownOpen(false);
                              }}
                            >
                              {item}
                            </button>
                          );
                        })
                      ) : (
                        <div className="cvv-select-no-results">
                          No matching Zips found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="cvv-form-group">
              <label htmlFor="fname">Fname (Cardholder Name)</label>
              <input
                id="fname"
                type="text"
                placeholder="John Doe"
                value={fname}
                onChange={(e) => setFname(e.target.value)}
              />
            </div>

            <div className="cvv-form-group">
              <label htmlFor="price">Price ($)</label>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="15.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>

            {/* Checkbox Flags */}
            <div className="cvv-form-group full-width">
              <label>Data Verification Flags (Included Data)</label>
              <div className="cvv-checkbox-grid">
                <label className="cvv-checkbox-item">
                  <input
                    type="checkbox"
                    checked={address}
                    onChange={(e) => setAddress(e.target.checked)}
                  />
                  Address
                </label>
                <label className="cvv-checkbox-item">
                  <input
                    type="checkbox"
                    checked={phone}
                    onChange={(e) => setPhone(e.target.checked)}
                  />
                  Phone
                </label>
                <label className="cvv-checkbox-item">
                  <input
                    type="checkbox"
                    checked={email}
                    onChange={(e) => setEmail(e.target.checked)}
                  />
                  Email
                </label>
                <label className="cvv-checkbox-item">
                  <input
                    type="checkbox"
                    checked={fullz}
                    onChange={(e) => setFullz(e.target.checked)}
                  />
                  Fullz
                </label>
                <label className="cvv-checkbox-item">
                  <input
                    type="checkbox"
                    checked={reference}
                    onChange={(e) => setReference(e.target.checked)}
                  />
                  Reference
                </label>
              </div>
            </div>
          </div>

          <div className="cvv-form-actions">
            <button
              type="submit"
              className="cvv-btn-submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Stock"
                : "Add CVV Stock"}
            </button>
            {editingId && (
              <>
                <button
                  type="button"
                  className="cvv-btn-delete"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="cvv-btn-cancel"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Bottom Table Display */}
      <div className="cvv-table-section">
        <div className="cvv-table-wrapper">
          <table className="cvv-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Bin</th>
                <th>Bank</th>
                <th>Type</th>
                <th>Level</th>
                <th>Expiry</th>
                <th>Location</th>
                <th>Flags</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="cvv-empty-row">
                    Loading CVV inventory from database...
                  </td>
                </tr>
              ) : cvvList.length > 0 ? (
                cvvList.map((item) => (
                  <tr
                    key={item.id}
                    className={editingId === item.id ? "selected" : ""}
                    onClick={() => handleSelectRow(item)}
                    title="Click row to edit details"
                  >
                    <td>#CVV-{item.id}</td>
                    <td>
                      <code>{item.bin}</code>
                    </td>
                    <td>{item.bank}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {item.cardType}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>
                      {item.cardLevel}
                    </td>
                    <td>{item.expiry || "N/A"}</td>
                    <td>
                      {item.city || "N/A"}, {item.country || "N/A"}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        {[
                          item.address && "Addr",
                          item.phone && "Phone",
                          item.email && "Email",
                          item.fullz && "Fullz",
                          item.reference && "Ref"
                        ]
                          .filter(Boolean)
                          .join(", ") || "None"}
                      </span>
                    </td>
                    <td>
                      <strong>${Number(item.price).toFixed(2)}</strong>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="cvv-empty-row">
                    No CVV inventory items found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}