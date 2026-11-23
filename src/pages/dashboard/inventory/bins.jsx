import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../utils/supabase";
import { COUNTRY } from "../../../components/countrys";
import "../../../styles/dashboard/inventory/bins.css";

export default function Bins() {
  const [binsList, setBinsList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const sortedCountries = useMemo(() => {
    if (!Array.isArray(COUNTRY)) return [];
    return [...COUNTRY].sort((a, b) => {
      const nameA = typeof a === "string" ? a : a.name || a.label || "";
      const nameB = typeof b === "string" ? b : b.name || b.label || "";
      return nameA.localeCompare(nameB);
    });
  }, []);

  // Form input states
  const [base, setBase] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState("");
  const [vendor, setVendor] = useState("");
  const [level, setLevel] = useState("");
  const [price, setPrice] = useState("");

  const fetchBins = async () => {
    const { data, error } = await supabase
      .from("bins_stock")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching bins stock:", error.message);
      return;
    }

    setBinsList(data || []);
  };

  useEffect(() => {
    let isMounted = true;

    const loadBins = async () => {
      const { data, error } = await supabase
        .from("bins_stock")
        .select("*")
        .order("id", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error("Error fetching bins stock:", error.message);
      } else {
        setBinsList(data || []);
      }
    };

    loadBins();

    return () => {
      isMounted = false;
    };
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setBase("");
    setCategory("");
    setCountry("");
    setType("");
    setVendor("");
    setLevel("");
    setPrice("");
  };

  const handleSelectRow = (item) => {
    setEditingId(item.id);
    setBase(item.base);
    setCategory(item.category);
    setCountry(item.country);
    setType(item.type);
    setVendor(item.vendor);
    setLevel(item.level);
    setPrice(item.price);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!base || !country || !price) {
      alert("Please fill in the required fields (Base, Country, Price).");
      return;
    }

    const payload = {
      base,
      category,
      country,
      type,
      vendor,
      level,
      price: parseFloat(price)
    };

    if (editingId) {
      const { error } = await supabase
        .from('bins_stock')
        .update(payload)
        .eq('id', editingId);

      if (error) {
        alert("Error updating stock: " + error.message);
      } else {
        alert("Bins stock item updated successfully!");
        fetchBins();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('bins_stock')
        .insert([payload]);

      if (error) {
        alert("Error adding stock: " + error.message);
      } else {
        alert("New Bins stock item added successfully!");
        fetchBins();
        resetForm();
      }
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (window.confirm("Are you sure you want to delete this Bins stock item?")) {
      const { error } = await supabase
        .from('bins_stock')
        .delete()
        .eq('id', editingId);

      if (error) {
        alert("Error deleting stock: " + error.message);
      } else {
        fetchBins();
        resetForm();
      }
    }
  };

  const handleCopyId = (e, id) => {
    e.stopPropagation();
    const textToCopy = `#BIN-${id}`;
    navigator.clipboard.writeText(textToCopy);
    alert(`Copied to clipboard: ${textToCopy}`);
  };

  return (
    <div className="bins-inventory-container">
      <h2 className="bins-header">Bins Inventory Management</h2>

      {/* Add / Edit Form Card */}
      <div className="bins-form-card">
        <h3 className="bins-form-title">
          {editingId ? `Editing Bins Item #BIN-${editingId}` : "Upload New Bins Stock"}
        </h3>

        <form onSubmit={handleSave}>
          <div className="bins-form-grid">
            <div className="bins-form-group">
              <label htmlFor="base">Base</label>
              <select id="base" value={base} onChange={(e) => setBase(e.target.value)} required>
                <option value="">Select a base</option>
                <option value="EUROPE">EUROPE</option>
                <option value="AUTO VBV USA">ASIAN</option>
                <option value="USA">USA</option>
                <option value="NOVBV WORLD MIX">NOVBV WORLD MIX</option>
                <option value="CANADA">CANADA</option>
                <option value="APPLE PAY">APPLE PAY</option>
                <option value="ASIAVEU NOVBV">ASIAVEU NOVBV</option>
                <option value="STRIPE">STRIPE</option>
                <option value="ASIAEU NOVBV">ASIAEU NOVBV</option>
              </select>
            </div>

            <div className="bins-form-group">
              <label htmlFor="category">Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select a Category</option>
                <option value="NOVBV">NOVBV</option>
                <option value="AUTOVBV">AUTOVBV</option>
              </select>
            </div>

            <div className="bins-form-group">
              <label htmlFor="country">Country</label>
              <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} required>
                <option value="" disabled>Select a country</option>
                {sortedCountries.map((c, index) => {
                  const value = typeof c === "string" ? c : c.code || c.value || c.name;
                  const label = typeof c === "string" ? c : c.name || c.label || value;
                  return (
                    <option key={value || index} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="bins-form-group">
              <label htmlFor="type">Type</label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Select type</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>

            <div className="bins-form-group">
              <label htmlFor="vendor">Vendor</label>
              <select id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                <option value="">Select vendor</option>
                <option value="american Express">American Express</option>
                <option value="mastercard">Mastercard</option>
                <option value="visa">Visa</option>
              </select>
            </div>

            <div className="bins-form-group">
              <label htmlFor="level">Level</label>
              <select id="level" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">Select level</option>
                <option value="gold">GOLD</option>
                <option value="infinite">INFINITE</option>
                <option value="mixed bin">MIXED BIN</option>
                <option value="mixed product">MIXED PRODUCT</option>
                <option value="personal gold charge">PERSONAL GOLD CHARGE</option>
                <option value="personal green revolve">PERSONAL GREEN REVOLVE</option>
                <option value="personal platinum revolve">PERSONAL PLATINUM REVOLVE</option>
                <option value="platinum">PLATINUM</option>
                <option value="platinum world">PLATINUM/WORLD</option>
                <option value="prepaid">PREPAID</option>
                <option value="prepaid business">PREPAID BUSINESS</option>
                <option value="prepaid corporate_te">PREPAID CORPORATE T&amp;E</option>
                <option value="prepaid electron">PREPAID ELECTRON</option>
                <option value="prepaid platinum">PREPAID PLATINUM</option>
                <option value="prepaid platinum_travel">PREPAID PLATINUM TRAVEL</option>
                <option value="prepaid purchasing">PREPAID PURCHASING</option>
                <option value="purchasing">PURCHASING</option>
                <option value="purchasing with fleet">PURCHASING WITH FLEET</option>
                <option value="signature">SIGNATURE</option>
                <option value="standard">STANDARD</option>
                <option value="titanium">TITANIUM</option>
                <option value="world">WORLD</option>
                <option value="world business">WORLD BUSINESS</option>
                <option value="world elite">WORLD ELITE</option>
                <option value="world elite for business">WORLD ELITE FOR BUSINESS</option>
                <option value="world for business">WORLD FOR BUSINESS</option>
              </select>
            </div>

            <div className="bins-form-group">
              <label htmlFor="price">Price ($)</label>
              <input 
                id="price" 
                type="number" 
                step="0.01" 
                min="0"
                placeholder="5.00" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="bins-form-actions">
            <button type="submit" className="bins-btn-submit">
              {editingId ? "Update Stock" : "Add Bins Stock"}
            </button>
            {editingId && (
              <>
                <button type="button" className="bins-btn-delete" onClick={handleDelete}>
                  Delete
                </button>
                <button type="button" className="bins-btn-cancel" onClick={resetForm}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Bottom Table Display */}
      <div className="bins-table-section">
        <div className="bins-table-wrapper">
          <table className="bins-table">
            <thead>
              <tr>
                <th>ID (Click to Copy)</th>
                <th>Base</th>
                <th>Category</th>
                <th>Country</th>
                <th>Type</th>
                <th>Vendor</th>
                <th>Level</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {binsList.length > 0 ? (
                binsList.map(item => (
                  <tr 
                    key={item.id} 
                    className={editingId === item.id ? "selected" : ""} 
                    onClick={() => handleSelectRow(item)}
                    title="Click row to edit details"
                  >
                    <td>
                      <code 
                        onClick={(e) => handleCopyId(e, item.id)} 
                        style={{ cursor: "pointer", textDecoration: "underline", color: "#3b82f6" }}
                        title="Click to copy ID"
                      >
                        #BIN-{item.id}
                      </code>
                    </td>
                    <td><code>{item.base}</code></td>
                    <td>
                      <span style={{ fontWeight: 600, color: item.category === "NOVBV" ? "#2563eb" : "#9333ea" }}>
                        {item.category}
                      </span>
                    </td>
                    <td>{item.country}</td>
                    <td style={{ textTransform: "capitalize" }}>{item.type}</td>
                    <td style={{ textTransform: "capitalize" }}>{item.vendor}</td>
                    <td style={{ textTransform: "capitalize" }}>{item.level}</td>
                    <td>
                      <span className="bins-price-badge">
                        ${Number(item.price).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="bins-empty-row">
                    No Bins inventory items found in database.
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