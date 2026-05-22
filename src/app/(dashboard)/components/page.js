"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./components.module.css";

export default function ComponentsPage() {
  const [creatures, setCreatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grouped"); // "grouped" or "flat"
  const [groupBy, setGroupBy] = useState("creature"); // "creature" or "filament"
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("creatures")
      .select("id, name, species, print_recipe")
      .eq("active", true)
      .order("log_number");
    
    setCreatures(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derive master component list from creature print recipes grouped by unique part name
  const componentsList = [];
  creatures.forEach(c => {
    if (!c.print_recipe) return;
    
    let recipeObj = null;
    if (typeof c.print_recipe === "string") {
      try {
        recipeObj = JSON.parse(c.print_recipe);
        if (typeof recipeObj === "string") {
          recipeObj = JSON.parse(recipeObj);
        }
      } catch (err) {
        console.error("Failed to parse print_recipe for creature " + c.name, err);
        return;
      }
    } else {
      recipeObj = c.print_recipe;
    }
    
    if (!recipeObj) return;
    
    const partsArray = Array.isArray(recipeObj) 
      ? recipeObj 
      : (recipeObj.recipe && Array.isArray(recipeObj.recipe)) 
        ? recipeObj.recipe 
        : [];
        
    // Group all filament configurations for this creature's parts
    const partsByName = {};
    partsArray.forEach(part => {
      const pName = part.label || part.part_name || "Unnamed Part";
      if (!partsByName[pName]) {
        partsByName[pName] = {
          partName: pName,
          creatureName: c.name,
          species: c.species,
          filaments: [],
          stock: 0
        };
      }
      
      const fName = part.filName || part.filament_color;
      if (fName) {
        const alreadyHasFilament = partsByName[pName].filaments.some(f => f.name === fName);
        if (!alreadyHasFilament) {
          partsByName[pName].filaments.push({
            name: fName,
            filId: part.filId || null
          });
        }
      }
      
      const rowStock = part.stock_on_hand || part.stock || part.qty || 0;
      partsByName[pName].stock = Math.max(partsByName[pName].stock, rowStock);
    });

    Object.values(partsByName).forEach(p => {
      componentsList.push(p);
    });
  });

  // Group componentsList dynamically based on `groupBy` state
  const grouped = {};
  componentsList.forEach(comp => {
    if (groupBy === "filament") {
      const filList = comp.filaments.length > 0 ? comp.filaments : [{ name: "No Filament Assigned" }];
      filList.forEach(filObj => {
        const key = filObj.name;
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            name: key,
            species: "Filament Group",
            parts: []
          };
        }
        // Avoid duplicate parts inside the same filament group
        const exists = grouped[key].parts.some(p => p.partName === comp.partName && p.creatureName === comp.creatureName);
        if (!exists) {
          grouped[key].parts.push(comp);
        }
      });
    } else {
      const key = comp.creatureName;
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          name: key,
          species: comp.species,
          parts: []
        };
      }
      grouped[key].parts.push(comp);
    }
  });
  
  // Filter grouped list by search query
  const groupedArray = Object.values(grouped).map(group => {
    const filteredParts = group.parts.filter(part => {
      if (!search) return true;
      const q = search.toLowerCase();
      const matchesName = part.partName.toLowerCase().includes(q) || group.name.toLowerCase().includes(q);
      const matchesFilament = part.filaments.some(f => f.name.toLowerCase().includes(q));
      return matchesName || matchesFilament;
    });
    return {
      ...group,
      parts: filteredParts
    };
  }).filter(group => group.parts.length > 0);

  // Filter flat list by search query
  const visibleComponents = componentsList.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const matchesName = c.partName.toLowerCase().includes(q) || c.creatureName.toLowerCase().includes(q);
    const matchesFilament = c.filaments.some(f => f.name.toLowerCase().includes(q));
    return matchesName || matchesFilament;
  });

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const collapseAll = () => {
    const newCollapsed = {};
    groupedArray.forEach(group => {
      newCollapsed[group.id] = true;
    });
    setCollapsedGroups(newCollapsed);
  };

  const expandAll = () => {
    setCollapsedGroups({});
  };

  // If searching, force expand everything. Otherwise, respect manual collapsed map.
  const isGroupCollapsed = (groupId) => {
    if (search) return false;
    return !!collapsedGroups[groupId];
  };

  return (
    <div>
      <div className="sec-hdr">
        <h1 className={styles.title}>Master Components List</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="fi"
            style={{ width: '200px', margin: 0 }}
            placeholder="Search parts or filaments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          
          <div style={{ display: 'flex', border: '1px solid var(--gold-border)', borderRadius: '4px', overflow: 'hidden' }}>
            <button 
              type="button" 
              className="btn sm" 
              style={{ 
                background: view === "grouped" ? "var(--gold)" : "transparent",
                color: view === "grouped" ? "var(--ink)" : "var(--gold)",
                border: 'none',
                borderRadius: 0,
                margin: 0,
                padding: '6px 12px',
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
              onClick={() => setView("grouped")}
            >
              Grouped Grid
            </button>
            <button 
              type="button" 
              className="btn sm" 
              style={{ 
                background: view === "flat" ? "var(--gold)" : "transparent",
                color: view === "flat" ? "var(--ink)" : "var(--gold)",
                border: 'none',
                borderRadius: 0,
                margin: 0,
                padding: '6px 12px',
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
              onClick={() => setView("flat")}
            >
              Flat List
            </button>
          </div>

          {view === "grouped" && (
            <>
              <div style={{ display: 'flex', border: '1px solid rgba(201, 168, 76, 0.4)', borderRadius: '4px', overflow: 'hidden' }}>
                <button 
                  type="button" 
                  className="btn sm" 
                  style={{ 
                    background: groupBy === "creature" ? "rgba(201, 168, 76, 0.25)" : "transparent",
                    color: "var(--goldl)",
                    border: 'none',
                    borderRadius: 0,
                    margin: 0,
                    padding: '6px 12px',
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}
                  onClick={() => setGroupBy("creature")}
                >
                  By Creature
                </button>
                <button 
                  type="button" 
                  className="btn sm" 
                  style={{ 
                    background: groupBy === "filament" ? "rgba(201, 168, 76, 0.25)" : "transparent",
                    color: "var(--goldl)",
                    border: 'none',
                    borderRadius: 0,
                    margin: 0,
                    padding: '6px 12px',
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}
                  onClick={() => setGroupBy("filament")}
                >
                  By Filament
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  className="btn sm" 
                  onClick={collapseAll} 
                  style={{ padding: '6px 10px', fontSize: '11px', margin: 0 }}
                >
                  Collapse All
                </button>
                <button 
                  className="btn sm" 
                  onClick={expandAll} 
                  style={{ padding: '6px 10px', fontSize: '11px', margin: 0 }}
                >
                  Expand All
                </button>
              </div>
            </>
          )}

          <button className="btn sm" onClick={load} style={{ margin: 0 }}>↺ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading components...</div>
      ) : view === "grouped" ? (
        groupedArray.length === 0 ? (
          <div className="empty-state">No components found.</div>
        ) : (
          <div className={styles.grid}>
            {groupedArray.map(group => {
              const collapsed = isGroupCollapsed(group.id);
              return (
                <div key={group.id} className={`${styles.card} ${collapsed ? styles.collapsedCard : ""}`}>
                  <div 
                    className={styles.cardHeader} 
                    onClick={() => toggleGroup(group.id)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`${styles.chevron} ${collapsed ? "" : styles.chevronOpen}`}>
                        ▶
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className={styles.creatureName}>{group.name}</span>
                        {groupBy === "creature" && (
                          <span className={styles.species}>{group.species}</span>
                        )}
                      </div>
                    </div>
                    
                    <span className={styles.partCountBadge}>
                      {group.parts.length} {group.parts.length === 1 ? "part" : "parts"}
                    </span>
                  </div>

                  {!collapsed && (
                    <div className={styles.partsList}>
                      {group.parts.map((part, idx) => (
                        <div key={idx} className={styles.partRow}>
                          <div className={styles.partInfo}>
                            <span className={styles.partLabel}>
                              {part.partName}
                              {groupBy === "filament" && (
                                <span className={styles.partCreature}> • {part.creatureName}</span>
                              )}
                            </span>
                            {groupBy === "creature" && part.filaments.length > 0 && (
                              <div className={styles.partFilamentsList}>
                                {part.filaments.map((fil, fIdx) => (
                                  <span key={fIdx} className={styles.partFilamentPill}>
                                    🧵 {fil.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ color: "var(--goldl)", fontWeight: "bold", fontSize: "15px", fontFamily: "sans-serif" }}>
                              {part.stock}
                            </span>
                            <span style={{ display: "block", fontSize: "8px", color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Stock</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Part Name</th>
                <th>Creature</th>
                <th>Filaments Used</th>
                <th>Stock Level</th>
              </tr>
            </thead>
            <tbody>
              {visibleComponents.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: "center" }}>No components found.</td></tr>
              ) : (
                visibleComponents.map((comp, idx) => (
                  <tr key={idx}>
                    <td><strong>{comp.partName}</strong></td>
                    <td>{comp.creatureName} <span style={{ color: 'var(--dim)' }}>({comp.species})</span></td>
                    <td>
                      {comp.filaments.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {comp.filaments.map((fil, fIdx) => (
                            <span key={fIdx} className={styles.pill}>{fil.name}</span>
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                    <td>
                      <span style={{ display: 'inline-block', width: '20px', textAlign: 'center', color: 'var(--goldl)', fontSize: '16px', fontWeight: 'bold' }}>
                        {comp.stock}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
