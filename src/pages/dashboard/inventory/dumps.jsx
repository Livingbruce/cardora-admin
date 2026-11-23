import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../../utils/supabase";
import { BASE, DumpLevel, CODE } from "../../../components/DumpBase";
import { bins, zipCode } from "../../../components/countrys";
import "../../../styles/dashboard/inventory/dumps.css";

export default function Dumps() {
  const [dumpsList, setDumpsList] = useState([]);

  const sortedBase = [...BASE].sort((a, b) => a.localeCompare(b));
  const sortedDumpLevel = [...DumpLevel].sort((a, b) => a.localeCompare(b));
  const sortedCode = [...CODE].sort((a, b) => Number(a) - Number(b));
  const sortedBin = useMemo(() => {
    if (!Array.isArray(bins)) return [];
    return [...bins].sort((a, b) => a.localeCompare(b));
  }, []);

  const sortedZip = useMemo(() => {
    if (!Array.isArray(zipCode)) return [];
    return [...zipCode].sort((a, b) => a.localeCompare(b));
  }, []);

  const [editingId, setEditingId] = useState(null);

  // Form input states
  const [base, setBase] = useState("EUROPE");
  const [bin, setBin] = useState("");
  const [country, setCountry] = useState("United State");
  const [type, setType] = useState("mastercard");
  const [level, setLevel] = useState(sortedDumpLevel[0] || "Classic");
  const [classType, setClassType] = useState("Standard");
  const [code, setCode] = useState(sortedCode[0] || "");
  const [zip, setZip] = useState("");
  const [track1, setTrack1] = useState(false);
  const [pin, setPin] = useState(false);
  const [price, setPrice] = useState("");

  const [zipSearch, setZipSearch] = useState("");
  const [binSearch, setBinSearch] = useState("");

  const [zipDropdownOpen, setZipDropdownOpen] = useState(false);
  const [binDropdownOpen, setBinDropdownOpen] = useState(false);

  const zipDropdownRef = useRef(null);
  const binDropdownRef = useRef(null);

  const zipSearchInputRef = useRef(null);
  const binSearchInputRef = useRef(null);

  const filteredZip = useMemo(() => {
    const query = zipSearch.trim().toLowerCase();
    const matches = query
      ? sortedZip.filter((item) => item.toLowerCase().includes(query))
      : sortedZip;

    if (zip && !matches.includes(zip)) {
      return [zip, ...matches];
    }
    return matches;
  }, [sortedZip, zipSearch, zip]);

  const filteredBin = useMemo(() => {
    const query = binSearch.trim().toLowerCase();
    const matches = query
      ? sortedBin.filter((item) => item.toLowerCase().includes(query))
      : sortedBin;

    if (bin && !matches.includes(bin)) {
      return [bin, ...matches];
    }
    return matches;
  }, [sortedBin, binSearch, bin]);

  useEffect(() => {
    let isMounted = true;

    const loadDumps = async () => {
      const { data, error } = await supabase
        .from("dumps_stock")
        .select("*")
        .order("id", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error("Error fetching dumps stock:", error.message);
      } else {
        setDumpsList(data || []);
      }
    };

    loadDumps();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const fetchDumps = async () => {
    const { data, error } = await supabase
      .from("dumps_stock")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching dumps stock:", error.message);
    } else {
      setDumpsList(data || []);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setBase("EUROPE");
    setBin("");
    setCountry("United State");
    setType("mastercard");
    setLevel(sortedDumpLevel[0] || "Classic");
    setClassType("Standard");
    setCode(sortedCode[0] || "");
    setZip("");
    setTrack1(false);
    setPin(false);
    setPrice("");
  };

  const handleSelectRow = (item) => {
    setEditingId(item.id);
    setBase(item.base);
    setBin(item.bin);
    setCountry(item.country);
    setType(item.type);
    setLevel(item.level);
    setClassType(item.class_type);
    setCode(item.code || "");
    setZip(item.zip || "");
    setTrack1(item.track1);
    setPin(item.pin);
    setPrice(item.price);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!bin || !price) {
      alert("Please fill in the required fields (Bin, Price).");
      return;
    }

    const payload = {
      base,
      bin,
      country,
      type,
      level,
      class_type: classType,
      code,
      zip,
      track1,
      pin,
      price: parseFloat(price)
    };

    if (editingId) {
      const { error } = await supabase
        .from('dumps_stock')
        .update(payload)
        .eq('id', editingId);

      if (error) {
        alert("Error updating stock: " + error.message);
      } else {
        alert("Dumps stock item updated successfully!");
        fetchDumps();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('dumps_stock')
        .insert([payload]);

      if (error) {
        alert("Error adding stock: " + error.message);
      } else {
        alert("New Dumps stock item added successfully!");
        fetchDumps();
        resetForm();
      }
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (window.confirm("Are you sure you want to delete this Dumps stock item?")) {
      const { error } = await supabase
        .from('dumps_stock')
        .delete()
        .eq('id', editingId);

      if (error) {
        alert("Error deleting stock: " + error.message);
      } else {
        fetchDumps();
        resetForm();
      }
    }
  };

  const handleCopyId = (e, id) => {
    e.stopPropagation(); // Prevent row selection trigger
    const textToCopy = `#DMP-${id}`;
    navigator.clipboard.writeText(textToCopy);
    alert(`Copied to clipboard: ${textToCopy}`);
  };

  return (
    <div className="dumps-inventory-container">
      <h2 className="dumps-header">Dumps Inventory Management</h2>

      {/* Add / Edit Form Card */}
      <div className="dumps-form-card">
        <h3 className="dumps-form-title">
          {editingId ? `Editing Dumps Item #DMP-${editingId}` : "Upload New Dumps Stock"}
        </h3>

        <form onSubmit={handleSave}>
          <div className="dumps-form-grid">
            <div className="dumps-form-group">
              <label htmlFor="base">Base</label>
              <select id="base" value={base} onChange={(e) => setBase(e.target.value)}>
                {sortedBase.map((item, index) => (
                  <option key={index} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="dumps-form-group">
              <label htmlFor="bin">Bin</label>
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

            <div className="dumps-form-group">
              <label htmlFor="country">Country</label>
              <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="Australia">Australia</option>
                <option value="United State">United State</option>
                <option value="Canada">Canada</option>
                <option value="Italy">Italy</option>
                <option value="United Kindom">United Kindom</option>
                <option value="Europe">Europe</option>
              </select>
            </div>

            <div className="dumps-form-group">
              <label htmlFor="type">Type</label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="american express">AMERICAN EXPRESS</option>
                <option value="discover">DISCOVER</option>
                <option value="mastercard">MASTERCARD</option>
                <option value="visa">VISA</option>
              </select>
            </div>

            <div className="dumps-form-group">
              <label htmlFor="level">Level</label>
              <select id="level" value={level} onChange={(e) => setLevel(e.target.value)}>
                {sortedDumpLevel.map((item, index) => (
                  <option key={index} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="dumps-form-group">
              <label htmlFor="classType">Class</label>
              <select id="classType" value={classType} onChange={(e) => setClassType(e.target.value)}>
                <option value="Standard">Standard</option>
                <option value="Business">Business</option>
                <option value="Corporate">Corporate</option>
              </select>
            </div>

            <div className="dumps-form-group">
              <label htmlFor="code">Code</label>
              <select id="code" value={code} onChange={(e) => setCode(e.target.value)}>
                {sortedCode.map((item, index) => (
                  <option key={index} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="dumps-form-group">
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
                          const isSelected = item === zip;
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

            <div className="dumps-form-group">
              <label htmlFor="price">Price ($)</label>
              <input id="price" type="number" step="0.01" placeholder="45.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>

            <div className="dumps-form-group full-width">
              <label>Flags & Features</label>
              <div className="dumps-checkbox-grid">
                <label className="dumps-checkbox-container">
                  <input type="checkbox" checked={track1} onChange={(e) => setTrack1(e.target.checked)} />
                  Track 1 (True/False)
                </label>
                <label className="dumps-checkbox-container">
                  <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} />
                  PIN (True/False)
                </label>
              </div>
            </div>
          </div>

          <div className="dumps-form-actions">
            <button type="submit" className="dumps-btn-submit">
              {editingId ? "Update Stock" : "Add Dumps Stock"}
            </button>
            {editingId && (
              <>
                <button type="button" className="dumps-btn-delete" onClick={handleDelete}>
                  Delete
                </button>
                <button type="button" className="dumps-btn-cancel" onClick={resetForm}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Bottom Table Display */}
      <div className="dumps-table-section">
        <div className="dumps-table-wrapper">
          <table className="dumps-table">
            <thead>
              <tr>
                <th>ID (Click to Copy)</th>
                <th>Base</th>
                <th>Bin</th>
                <th>Country</th>
                <th>Type / Level</th>
                <th>Code</th>
                <th>Zip</th>
                <th>Track 1</th>
                <th>PIN</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {dumpsList.length > 0 ? (
                dumpsList.map(item => (
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
                        #DMP-{item.id}
                      </code>
                    </td>
                    <td>{item.base}</td>
                    <td><code>{item.bin}</code></td>
                    <td>{item.country}</td>
                    <td>{item.type} / {item.level}</td>
                    <td>{item.code || "N/A"}</td>
                    <td>{item.zip || "N/A"}</td>
                    <td>
                      <span style={{ color: item.track1 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                        {item.track1 ? "True" : "False"}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: item.pin ? "#059669" : "#dc2626", fontWeight: 600 }}>
                        {item.pin ? "True" : "False"}
                      </span>
                    </td>
                    <td><strong>${Number(item.price).toFixed(2)}</strong></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="dumps-empty-row">
                    No Dumps inventory items found in database.
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