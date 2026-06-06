import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── ROLE MAP ────────────────────────────────────────────────────────────────
const ROLE_MAP = {
  "juhi@prabhatdiesels.com":  { role: "admin",  name: "Juhi Yadav"  },
  "akash@prabhatdiesels.com": { role: "viewer", name: "Akash Sharma" },
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const initData = () => ({ totalVisit:[], courtesyVisit:[], amc:[], quotation:[], amcOffer:[], billing:[], purchase:[], vinodApproval:[] });
const genId     = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const getAmcStatus = (to) => { if (!to) return "-"; return new Date(to) >= new Date() ? "Active" : "Expired"; };

const loadFromFirestore = async () => {
  try {
    const ref = doc(db, "appdata", "main");
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    return initData();
  } catch (e) { console.error("Load error:", e); return initData(); }
};

const saveToFirestore = async (data) => {
  try {
    const ref = doc(db, "appdata", "main");
    await setDoc(ref, data);
  } catch (e) { console.error("Save error:", e); }
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#0f1117", surface:"#1a1d27", surfaceAlt:"#1e2130", surfaceHover:"#252840",
  border:"#2a2d3e", borderLight:"#363950",
  accent:"#6366f1", accentHover:"#4f46e5", accentBg:"rgba(99,102,241,0.12)", accentDim:"#818cf8",
  text:"#f1f5f9", textMuted:"#94a3b8", textDim:"#cbd5e1",
  green:"#10b981", greenBg:"rgba(16,185,129,0.1)", greenBorder:"rgba(16,185,129,0.3)",
  red:"#f43f5e", redBg:"rgba(244,63,94,0.1)", redBorder:"rgba(244,63,94,0.3)",
  blue:"#3b82f6", blueBg:"rgba(59,130,246,0.1)", blueBorder:"rgba(59,130,246,0.3)",
  yellow:"#f59e0b", yellowBg:"rgba(245,158,11,0.1)", yellowBorder:"rgba(245,158,11,0.3)",
  purple:"#a78bfa", purpleBg:"rgba(167,139,250,0.1)", purpleBorder:"rgba(167,139,250,0.3)",
  orange:"#fb923c", orangeBg:"rgba(251,146,60,0.1)", orangeBorder:"rgba(251,146,60,0.3)",
  shadow:"0 2px 8px rgba(0,0,0,0.4)", shadowMd:"0 4px 16px rgba(0,0,0,0.5)", shadowLg:"0 10px 40px rgba(0,0,0,0.6)",
};

const PIE_COLORS = ["#6366f1","#10b981","#f43f5e","#f59e0b","#a78bfa","#fb923c"];

const mkInp = () => ({
  background: C.surfaceAlt, border: `1.5px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 11px", width: "100%", outline: "none",
  fontSize: 13, boxSizing: "border-box",
  transition: "border-color 0.2s",
});
const mkSel = () => ({
  background: C.surfaceAlt, border: `1.5px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 11px", outline: "none", fontSize: 13,
  cursor: "pointer", width: "100%",
});
const mkTh = () => ({
  background: C.surface, color: C.textMuted, padding: "11px 14px",
  textAlign: "left", borderBottom: `1.5px solid ${C.border}`,
  fontWeight: 700, textTransform: "uppercase", fontSize: 10,
  letterSpacing: "0.08em", whiteSpace: "nowrap", fontFamily:"'DM Mono', monospace",
});
const mkTd = () => ({
  padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
  color: C.textDim, verticalAlign: "middle",
});

const badge = (bg, color, text) => (
  <span style={{
    background: bg, color, border: `1px solid ${color}55`,
    borderRadius: 20, padding: "3px 12px", fontSize: 11,
    fontWeight: 700, display: "inline-block", whiteSpace: "nowrap",
    letterSpacing: "0.04em",
  }}>{text}</span>
);

const BADGE_MAPS = {
  visitType:  { BD:[C.blueBg,C.blue,"BD"], AMC:[C.greenBg,C.green,"AMC"], GCL:[C.purpleBg,C.purple,"GCL"] },
  amcType:    { GCL:[C.purpleBg,C.purple,"GCL"], Prabhat:[C.orangeBg,C.orange,"Prabhat"] },
  amcStatus:  { Active:[C.greenBg,C.green,"Active"], Expired:[C.redBg,C.red,"Expired"], "-":[C.surfaceAlt,C.textMuted,"—"] },
  qType:      { service:[C.blueBg,C.blue,"Service"], parts:[C.yellowBg,C.yellow,"Parts"] },
  qStatus:    { infollowing:[C.blueBg,C.blue,"In Following"], approved:[C.greenBg,C.green,"Approved"], "need higher authorized":[C.redBg,C.red,"Need Higher Auth"] },
  billType:   { spars:[C.yellowBg,C.yellow,"Spares"], service:[C.blueBg,C.blue,"Service"], GCL:[C.purpleBg,C.purple,"GCL"] },
  openClose:  { open:[C.orangeBg,C.orange,"Open"], close:[C.greenBg,C.green,"Closed"] },
};

function BadgeCell({ val, map }) {
  const m = BADGE_MAPS[map]?.[val];
  if (!m) return <span style={{ color:C.textMuted }}>—</span>;
  return badge(m[0], m[1], m[2]);
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const ROWS_PER_PAGE = 20;

const filterByMonth = (rows, month) => {
  if (!month) return rows;
  const [yr, mo] = month.split("-");
  return rows.filter(r => {
    const d = r.date || r.from || "";
    if (!d) return false;
    const [ry, rm] = d.split("-");
    return ry === yr && rm === mo;
  });
};

// Date-wise sort: newest first
const sortByDate = (rows) => {
  return [...rows].sort((a, b) => {
    const da = a.date || a.from || "";
    const db2 = b.date || b.from || "";
    if (!da && !db2) return 0;
    if (!da) return 1;
    if (!db2) return -1;
    return db2.localeCompare(da);
  });
};

function exportToCSV(rows, columns, filename) {
  if (!rows.length) { alert("No data to export!"); return; }
  const headers = columns.filter(c => c.key !== "srno").map(c => c.label);
  const dataRows = rows.map(row => columns.filter(c => c.key !== "srno").map(c => {
    if (c.key === "amcStatus") return getAmcStatus(row.to);
    return row[c.key] || "";
  }));
  const csv = [headers, ...dataRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
function Pagination({ total, page, setPage }) {
  const totalPages = Math.ceil(total / ROWS_PER_PAGE);
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderTop:`1px solid ${C.border}`, background:C.surface }}>
      <span style={{ color:C.textMuted, fontSize:12 }}>
        Showing {(page-1)*ROWS_PER_PAGE+1}–{Math.min(page*ROWS_PER_PAGE,total)} of {total} records
      </span>
      <div style={{ display:"flex", gap:4 }}>
        <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
          style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:page===1?C.surface:C.surfaceHover, color:page===1?C.textMuted:C.text, cursor:page===1?"default":"pointer", fontSize:12, fontWeight:600 }}>
          ← Prev
        </button>
        {pages.map(p=>(
          <button key={p} onClick={()=>setPage(p)}
            style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${p===page?C.accent:C.border}`, background:p===page?C.accent:C.surfaceHover, color:p===page?"#fff":C.textMuted, cursor:"pointer", fontSize:12, fontWeight:p===page?700:400 }}>
            {p}
          </button>
        ))}
        <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
          style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:page===totalPages?C.surface:C.surfaceHover, color:page===totalPages?C.textMuted:C.text, cursor:page===totalPages?"default":"pointer", fontSize:12, fontWeight:600 }}>
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── ADD ROW FORM (top) ───────────────────────────────────────────────────────
function AddRowForm({ columns, onAdd }) {
  const [newRow, setNewRow] = useState({});
  const inp = mkInp(); const sel = mkSel();
  const handleAdd = () => { onAdd(newRow); setNewRow({}); };
  return (
    <div style={{ background:C.accentBg, border:`1.5px solid ${C.accent}44`, borderRadius:14, padding:"16px 18px", marginBottom:18 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:C.accent }}/>
        <span style={{ fontSize:12, fontWeight:700, color:C.accent, textTransform:"uppercase", letterSpacing:"0.07em" }}>Add New Entry</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:10, alignItems:"end" }}>
        {columns.filter(c => c.key !== "srno" && c.key !== "amcStatus").map(c => (
          <div key={c.key}>
            <label style={{ fontSize:10, fontWeight:700, color:C.textMuted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>{c.label}</label>
            {c.type === "select"
              ? <select style={sel} value={newRow[c.key]||""} onChange={e=>setNewRow(r=>({...r,[c.key]:e.target.value}))}>
                  <option value="">Select</option>
                  {c.options.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              : <input style={inp} type={c.inputType||"text"} placeholder={c.label} value={newRow[c.key]||""} onChange={e=>setNewRow(r=>({...r,[c.key]:e.target.value}))}/>
            }
          </div>
        ))}
        <div>
          <label style={{ fontSize:10, color:"transparent", display:"block", marginBottom:5 }}>-</label>
          <button onClick={handleAdd}
            style={{ width:"100%", padding:"9px 18px", background:`linear-gradient(135deg,${C.accent},${C.accentHover})`, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13, boxShadow:`0 4px 12px ${C.accent}44` }}>
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EDITABLE TABLE ───────────────────────────────────────────────────────────
function EditableTable({ columns, rows, isAdmin, onAdd, onUpdate, onDelete, selectedMonth, exportFilename }) {
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [page, setPage] = useState(1);
  const th = mkTh(); const td = mkTd(); const inp = mkInp(); const sel = mkSel();

  // Filter by month then sort by date
  const filtered = selectedMonth ? filterByMonth(rows, selectedMonth) : rows;
  const sorted = sortByDate(filtered);
  const totalRows = sorted.length;
  const pageRows = sorted.slice((page-1)*ROWS_PER_PAGE, page*ROWS_PER_PAGE);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [selectedMonth]);

  return (
    <div>
      {/* Add form at top - only for admin */}
      {isAdmin && onAdd && (
        <div style={{ padding:"16px 16px 0" }}>
          <AddRowForm columns={columns} onAdd={(row)=>{ onAdd(row); setPage(1); }}/>
        </div>
      )}

      {/* Export button for viewer */}
      {!isAdmin && exportFilename && (
        <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end" }}>
          <button onClick={()=>exportToCSV(sorted, columns, exportFilename+(selectedMonth?"_"+selectedMonth:""))}
            style={{ background:C.green, color:"#fff", border:"none", borderRadius:7, padding:"7px 16px", cursor:"pointer", fontWeight:700, fontSize:12 }}>
            ⬇ Download CSV {selectedMonth?`(${selectedMonth})`:""}
          </button>
        </div>
      )}

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr>
              {columns.map(c=><th key={c.key} style={th}>{c.label}</th>)}
              {isAdmin && <th style={th}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={row.id} style={{ background:i%2===0?C.surface:C.surfaceAlt, transition:"background 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=C.surfaceHover}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.surface:C.surfaceAlt}>
                {columns.map(c => (
                  <td key={c.key} style={td}>
                    {editId===row.id && isAdmin && c.key!=="srno" && c.key!=="amcStatus" ? (
                      c.type==="select"
                        ? <select style={sel} value={editRow[c.key]||""} onChange={e=>setEditRow(r=>({...r,[c.key]:e.target.value}))}>
                            <option value="">Select</option>
                            {c.options.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                        : <input style={inp} type={c.inputType||"text"} value={editRow[c.key]??""} onChange={e=>setEditRow(r=>({...r,[c.key]:e.target.value}))}/>
                    ) : c.key==="srno" ? (
                      <span style={{ color:C.textMuted, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>{(page-1)*ROWS_PER_PAGE+i+1}</span>
                    ) : c.key==="amcStatus" ? (
                      <BadgeCell val={getAmcStatus(editId===row.id?editRow.to:row.to)} map="amcStatus"/>
                    ) : c.badge ? (
                      <BadgeCell val={row[c.key]} map={c.badge}/>
                    ) : (
                      <span style={{ color:C.text }}>{row[c.key]||<span style={{ color:C.border }}>—</span>}</span>
                    )}
                  </td>
                ))}
                {isAdmin && (
                  <td style={td}>
                    <div style={{ display:"flex", gap:5 }}>
                      {editId===row.id ? (
                        <>
                          <button style={{ background:C.green, color:"#fff", border:"none", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:700 }} onClick={()=>{ onUpdate(row.id,editRow); setEditId(null); }}>Save</button>
                          <button style={{ background:C.surfaceAlt, color:C.textMuted, border:`1px solid ${C.border}`, borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11 }} onClick={()=>setEditId(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button style={{ background:C.accentBg, color:C.accentDim, border:`1px solid ${C.accent}44`, borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:700 }} onClick={()=>{ setEditId(row.id); setEditRow({...row}); }}>Edit</button>
                          <button style={{ background:C.redBg, color:C.red, border:`1px solid ${C.red}44`, borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:700 }} onClick={()=>{ if(window.confirm("Delete this record?")) onDelete(row.id); }}>Del</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {pageRows.length===0 && (
              <tr><td colSpan={columns.length+(isAdmin?1:0)} style={{ ...td, textAlign:"center", padding:40, color:C.textMuted }}>
                {selectedMonth?`No records for ${selectedMonth}`:"No records found"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination total={totalRows} page={page} setPage={setPage}/>
    </div>
  );
}

// ─── PAGE WRAPPER ─────────────────────────────────────────────────────────────
function PageWrapper({ title, icon, count, children }) {
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:22 }}>
        <div style={{ width:50, height:50, background:`linear-gradient(135deg,${C.accent},${C.accentHover})`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:`0 4px 16px ${C.accent}44` }}>{icon}</div>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text, letterSpacing:"-0.02em" }}>{title}</h2>
          <div style={{ color:C.textMuted, fontSize:12, marginTop:3 }}>{count} record{count!==1?"s":""} total</div>
        </div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:"hidden", boxShadow:C.shadowMd }}>
        {children}
      </div>
    </div>
  );
}

function useTableOps(key, data, setData) {
  const rows = data[key];
  const set = (fn) => setData(d=>({...d,[key]:fn(d[key])}));
  return {
    rows,
    onAdd:    (row) => set(r=>[...r,{id:genId(),...row}]),
    onUpdate: (id,upd) => set(r=>r.map(x=>x.id===id?{...x,...upd}:x)),
    onDelete: (id) => set(r=>r.filter(x=>x.id!==id)),
  };
}

// ─── COLUMN DEFS ─────────────────────────────────────────────────────────────
const visitCols    = [{key:"srno",label:"#"},{key:"date",label:"Date",inputType:"date"},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"type",label:"Type",type:"select",options:["BD","AMC","GCL"],badge:"visitType"},{key:"technician",label:"Technician"},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"}];
const courtesyCols = [{key:"srno",label:"#"},{key:"date",label:"Date",inputType:"date"},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"location",label:"Location"},{key:"technician",label:"Technician"},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"}];
const amcCols      = [{key:"srno",label:"#"},{key:"esn",label:"ESN"},{key:"customer",label:"Customer"},{key:"type",label:"Type",type:"select",options:["GCL","Prabhat"],badge:"amcType"},{key:"from",label:"From",inputType:"date"},{key:"to",label:"To",inputType:"date"},{key:"amcStatus",label:"Status"}];
// Quotation: multiple quotation numbers per company allowed (no auto-link to billing)
const quotCols     = [{key:"srno",label:"#"},{key:"date",label:"Date",inputType:"date"},{key:"quotationNo",label:"Quotation No."},{key:"customer",label:"Customer"},{key:"type",label:"Type",type:"select",options:["service","parts"],badge:"qType"},{key:"amount",label:"Amount",inputType:"number"},{key:"status",label:"Status",type:"select",options:["infollowing","approved","need higher authorized"],badge:"qStatus"},{key:"technician",label:"Technician"}];
const amcOfferCols = [{key:"srno",label:"#"},{key:"date",label:"Date",inputType:"date"},{key:"esn",label:"ESN"},{key:"customer",label:"Customer"},{key:"amount",label:"Amount",inputType:"number"},{key:"status",label:"Status",type:"select",options:["infollowing","approved","need higher authorized"],badge:"qStatus"},{key:"technician",label:"Technician"}];
// Billing: added billNo column
const billingCols  = [{key:"srno",label:"#"},{key:"date",label:"Date",inputType:"date"},{key:"billNo",label:"Bill No."},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"type",label:"Type",type:"select",options:["spars","service","GCL"],badge:"billType"},{key:"quotation",label:"Quotation No."},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"},{key:"technician",label:"Technician"},{key:"amount",label:"Amount",inputType:"number"}];
const purchaseCols = [{key:"srno",label:"#"},{key:"date",label:"Date",inputType:"date"},{key:"customer",label:"Customer"},{key:"amount",label:"Amount",inputType:"number"}];
const vinodCols    = [{key:"srno",label:"#"},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"complaintType",label:"Complaint Type"},{key:"date",label:"Date",inputType:"date"},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"}];

// ─── PAGES ────────────────────────────────────────────────────────────────────
function TotalVisitPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("totalVisit",data,setData);
  return <PageWrapper title="Total Visit" icon="📋" count={rows.length}><EditableTable columns={visitCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="TotalVisit"/></PageWrapper>;
}
function CourtesyVisitPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("courtesyVisit",data,setData);
  return <PageWrapper title="Courtesy Visit" icon="🤝" count={rows.length}><EditableTable columns={courtesyCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="CourtesyVisit"/></PageWrapper>;
}
function AmcPage({ data,setData,isAdmin,selectedMonth }) {
  const [sub,setSub]=useState("table");
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("amc",data,setData);
  const displayRows=selectedMonth?filterByMonth(rows,selectedMonth):rows;
  const prabhatActive=displayRows.filter(r=>r.type==="Prabhat"&&getAmcStatus(r.to)==="Active").length;
  const gclActive=displayRows.filter(r=>r.type==="GCL"&&getAmcStatus(r.to)==="Active").length;
  const expired=displayRows.filter(r=>getAmcStatus(r.to)==="Expired").length;
  const pieData=[{name:"Prabhat Active",value:prabhatActive},{name:"GCL Active",value:gclActive},{name:"Expired",value:expired}].filter(d=>d.value>0);
  const ttp={contentStyle:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}};
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
        <div style={{ width:50,height:50,background:`linear-gradient(135deg,${C.accent},${C.accentHover})`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:`0 4px 16px ${C.accent}44` }}>🔄</div>
        <div><h2 style={{ margin:0,fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-0.02em" }}>AMC</h2><div style={{ color:C.textMuted,fontSize:12 }}>{rows.length} records</div></div>
      </div>
      <div style={{ display:"flex",gap:8,marginBottom:18 }}>
        {[["table","📋 Table"],["chart","🥧 Chart"]].map(([id,label])=>(
          <button key={id} onClick={()=>setSub(id)} style={{ background:sub===id?C.accent:C.surface,color:sub===id?"#fff":C.textMuted,border:`1.5px solid ${sub===id?C.accent:C.border}`,borderRadius:8,padding:"7px 18px",cursor:"pointer",fontWeight:sub===id?700:500,fontSize:13 }}>{label}</button>
        ))}
      </div>
      {sub==="table" ? (
        <div style={{ background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow }}>
          <EditableTable columns={amcCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="AMC"/>
        </div>
      ) : (
        <div style={{ display:"flex",gap:20,flexWrap:"wrap" }}>
          <div style={{ background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:14,padding:24,flex:1,minWidth:280,boxShadow:C.shadow }}>
            <div style={{ fontWeight:700,marginBottom:16,color:C.text }}>AMC Status</div>
            {pieData.length>0
              ? <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>{pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}</Pie><Tooltip {...ttp}/></PieChart></ResponsiveContainer>
              : <div style={{ textAlign:"center",padding:40,color:C.textMuted }}>No data yet</div>}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:12,minWidth:200 }}>
            {[{label:"Prabhat Active",value:prabhatActive,color:C.orange,bg:C.orangeBg},{label:"GCL Active",value:gclActive,color:C.purple,bg:C.purpleBg},{label:"Expired",value:expired,color:C.red,bg:C.redBg}].map(s=>(
              <div key={s.label} style={{ background:s.bg,border:`1.5px solid ${s.color}44`,borderLeft:`4px solid ${s.color}`,borderRadius:12,padding:18 }}>
                <div style={{ color:C.textMuted,fontSize:12 }}>{s.label}</div>
                <div style={{ fontSize:32,fontWeight:900,color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function QuotationPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("quotation",data,setData);
  return (
    <PageWrapper title="Quotation Sent" icon="📄" count={rows.length}>
      {isAdmin && <div style={{ background:C.accentBg,borderBottom:`1px solid ${C.border}`,padding:"9px 16px",fontSize:12,color:C.accentDim }}>💡 Multiple quotations per company are supported — each gets its own Quotation No.</div>}
      <EditableTable columns={quotCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="Quotation"/>
    </PageWrapper>
  );
}
function AmcOfferPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("amcOffer",data,setData);
  return <PageWrapper title="AMC Offer" icon="📝" count={rows.length}><EditableTable columns={amcOfferCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="AMCOffer"/></PageWrapper>;
}
function BillingPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("billing",data,setData);
  return (
    <PageWrapper title="Billing" icon="💰" count={rows.length}>
      {isAdmin && <div style={{ background:C.accentBg,borderBottom:`1px solid ${C.border}`,padding:"9px 16px",fontSize:12,color:C.accentDim }}>💡 Bill No. aur Quotation No. manually enter karo</div>}
      <EditableTable columns={billingCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="Billing"/>
    </PageWrapper>
  );
}
function PurchasePage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("purchase",data,setData);
  return <PageWrapper title="Total Purchase" icon="🛒" count={rows.length}><EditableTable columns={purchaseCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="Purchase"/></PageWrapper>;
}
function VinodApprovalPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("vinodApproval",data,setData);
  return <PageWrapper title="Vinod Sir Approval" icon="✅" count={rows.length}><EditableTable columns={vinodCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="VinodApproval"/></PageWrapper>;
}

// ─── CEO DASHBOARD ────────────────────────────────────────────────────────────
function StatBox({ label,value,icon,color,bg }) {
  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",boxShadow:C.shadow,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:color,borderRadius:"14px 14px 0 0" }}/>
      <div style={{ width:36,height:36,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:10 }}>{icon}</div>
      <div style={{ fontSize:24,fontWeight:900,color:C.text,lineHeight:1,fontFamily:"'DM Mono',monospace" }}>{value}</div>
      <div style={{ color:C.textMuted,fontSize:12,marginTop:5,fontWeight:500 }}>{label}</div>
    </div>
  );
}

function ChartCard({ title,children,empty }) {
  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,boxShadow:C.shadow }}>
      <div style={{ fontWeight:700,marginBottom:14,color:C.text,fontSize:14 }}>{title}</div>
      {empty ? <div style={{ textAlign:"center",padding:40,color:C.textMuted,fontSize:13 }}>No data yet</div> : children}
    </div>
  );
}

function CeoDashboard({ data, selectedMonth }) {
  const { totalVisit:tv, courtesyVisit:cv, amc, quotation:quot, amcOffer, billing:bill, purchase:purch, vinodApproval } = data;
  const fTv=selectedMonth?filterByMonth(tv,selectedMonth):tv;
  const fCv=selectedMonth?filterByMonth(cv,selectedMonth):cv;
  const fBill=selectedMonth?filterByMonth(bill,selectedMonth):bill;
  const fQuot=selectedMonth?filterByMonth(quot,selectedMonth):quot;
  const fPurch=selectedMonth?filterByMonth(purch,selectedMonth):purch;
  const fAmcO=selectedMonth?filterByMonth(amcOffer,selectedMonth):amcOffer;
  const fAmc=selectedMonth?filterByMonth(amc,selectedMonth):amc;
  const fVinod=selectedMonth?filterByMonth(vinodApproval,selectedMonth):vinodApproval;
  const prabhatActive=fAmc.filter(r=>r.type==="Prabhat"&&getAmcStatus(r.to)==="Active").length;
  const gclActive=fAmc.filter(r=>r.type==="GCL"&&getAmcStatus(r.to)==="Active").length;
  const expired=fAmc.filter(r=>getAmcStatus(r.to)==="Expired").length;
  const closedBilling=fBill.filter(r=>r.status==="close");
  const totalBilled=fBill.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const totalPurch=fPurch.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const totalQuotAmt=fQuot.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const sparsAmt=closedBilling.filter(r=>r.type==="spars").reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const serviceAmt=closedBilling.filter(r=>r.type==="service").reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const gclAmt=closedBilling.filter(r=>r.type==="GCL").reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const visitTypeData=["BD","AMC","GCL"].map(type=>({type,count:fTv.filter(r=>r.type===type).length}));
  const getTechData=(rows)=>{ const map={}; rows.forEach(r=>{ if(r.technician) map[r.technician]=(map[r.technician]||0)+1; }); return Object.entries(map).map(([name,visits])=>({name,visits})).sort((a,b)=>b.visits-a.visits); };
  const tvTechData=getTechData(fTv); const cvTechData=getTechData(fCv);
  const amcPieData=[{name:"Prabhat Active",value:prabhatActive},{name:"GCL Active",value:gclActive},{name:"Expired",value:expired}].filter(d=>d.value>0);
  const quotAmtData=[{name:"In Following",amount:fQuot.filter(q=>q.status==="infollowing").reduce((s,r)=>s+(parseFloat(r.amount)||0),0),color:C.blue,bg:C.blueBg},{name:"Approved",amount:fQuot.filter(q=>q.status==="approved").reduce((s,r)=>s+(parseFloat(r.amount)||0),0),color:C.green,bg:C.greenBg},{name:"Need Higher Auth",amount:fQuot.filter(q=>q.status==="need higher authorized").reduce((s,r)=>s+(parseFloat(r.amount)||0),0),color:C.red,bg:C.redBg}];
  const amcOfferStatusData=[{name:"In Following",amount:fAmcO.filter(r=>r.status==="infollowing").reduce((s,r)=>s+(parseFloat(r.amount)||0),0),color:C.blue,bg:C.blueBg},{name:"Approved",amount:fAmcO.filter(r=>r.status==="approved").reduce((s,r)=>s+(parseFloat(r.amount)||0),0),color:C.green,bg:C.greenBg},{name:"Need Higher Auth",amount:fAmcO.filter(r=>r.status==="need higher authorized").reduce((s,r)=>s+(parseFloat(r.amount)||0),0),color:C.red,bg:C.redBg}];
  const totalAmcOfferAmt=amcOfferStatusData.reduce((s,r)=>s+r.amount,0);
  const techBillMap={}; closedBilling.forEach(r=>{ if(r.technician) techBillMap[r.technician]=(techBillMap[r.technician]||0)+(parseFloat(r.amount)||0); });
  const techBillData=Object.entries(techBillMap).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);
  const kpis=[{label:"Total Visits",value:fTv.length,icon:"📋",color:C.blue,bg:C.blueBg},{label:"Courtesy Visits",value:fCv.length,icon:"🤝",color:C.purple,bg:C.purpleBg},{label:"Active AMCs",value:prabhatActive+gclActive,icon:"✅",color:C.green,bg:C.greenBg},{label:"Expired AMCs",value:expired,icon:"⚠️",color:C.red,bg:C.redBg},{label:"Quotations",value:fQuot.length,icon:"📄",color:C.yellow,bg:C.yellowBg},{label:"AMC Offers",value:fAmcO.length,icon:"📝",color:C.orange,bg:C.orangeBg},{label:"Total Billed",value:`₹${totalBilled.toLocaleString()}`,icon:"💰",color:C.green,bg:C.greenBg},{label:"Total Purchase",value:`₹${totalPurch.toLocaleString()}`,icon:"🛒",color:C.blue,bg:C.blueBg}];
  const th=mkTh(); const td=mkTd();
  const ttp={contentStyle:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}};
  return (
    <div style={{ padding:28, overflowY:"auto" }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:0,fontSize:22,fontWeight:900,color:C.text,letterSpacing:"-0.02em" }}>⚡ CEO Dashboard</h2>
        <p style={{ color:C.textMuted,margin:"4px 0 0",fontSize:13 }}>Prabhat Diesels • Live Overview {selectedMonth && <span style={{ marginLeft:10,background:C.accentBg,color:C.accentDim,borderRadius:20,padding:"2px 12px",fontSize:12,fontWeight:700 }}>📅 {selectedMonth}</span>}</p>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:26 }}>
        {kpis.map(k=><StatBox key={k.label} {...k}/>)}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
        <ChartCard title="📋 Total Visit — Type Breakdown" empty={fTv.length===0}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:14 }}>
            <thead><tr>{["Type","Visits","% Share"].map(h=><th key={h} style={{ ...th,fontSize:11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {visitTypeData.map(r=>(
                <tr key={r.type}><td style={td}><BadgeCell val={r.type} map="visitType"/></td><td style={{ ...td,fontWeight:800,fontSize:20,color:C.text,fontFamily:"'DM Mono',monospace" }}>{r.count}</td><td style={{ ...td,color:C.textMuted }}>{fTv.length>0?((r.count/fTv.length)*100).toFixed(1)+"%":"—"}</td></tr>
              ))}
              <tr style={{ borderTop:`2px solid ${C.border}` }}><td style={{ ...td,fontWeight:700,color:C.text }}>Total</td><td style={{ ...td,fontWeight:900,fontSize:20,color:C.accent,fontFamily:"'DM Mono',monospace" }}>{fTv.length}</td><td style={{ ...td,color:C.textMuted }}>100%</td></tr>
            </tbody>
          </table>
        </ChartCard>
        <ChartCard title="🥧 AMC Status" empty={amcPieData.length===0}>
          <ResponsiveContainer width="100%" height={230}><PieChart><Pie data={amcPieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>{amcPieData.map((_,i)=><Cell key={i} fill={[C.green,C.purple,C.red][i]}/>)}</Pie><Tooltip {...ttp}/></PieChart></ResponsiveContainer>
        </ChartCard>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
        <ChartCard title="👷 Technician — Total Visit" empty={tvTechData.length===0}>
          <ResponsiveContainer width="100%" height={230}><BarChart data={tvTechData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis type="number" tick={{ fill:C.textMuted,fontSize:11 }}/><YAxis dataKey="name" type="category" tick={{ fill:C.textDim,fontSize:11 }} width={90}/><Tooltip {...ttp}/><Bar dataKey="visits" fill={C.blue} radius={[0,5,5,0]}/></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="👷 Technician — Courtesy Visit" empty={cvTechData.length===0}>
          <ResponsiveContainer width="100%" height={230}><BarChart data={cvTechData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis type="number" tick={{ fill:C.textMuted,fontSize:11 }}/><YAxis dataKey="name" type="category" tick={{ fill:C.textDim,fontSize:11 }} width={90}/><Tooltip {...ttp}/><Bar dataKey="visits" fill={C.purple} radius={[0,5,5,0]}/></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
        <ChartCard title="📄 Quotation Amount by Status">
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {quotAmtData.map(q=>(
              <div key={q.name} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:q.bg,borderRadius:9,border:`1px solid ${q.color}33` }}>
                <span style={{ color:C.textDim,fontSize:13 }}>{q.name}</span>
                <span style={{ color:q.color,fontWeight:800,fontSize:18,fontFamily:"'DM Mono',monospace" }}>₹{q.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:C.yellowBg,borderRadius:9,border:`1px solid ${C.yellow}44` }}>
              <span style={{ color:C.text,fontWeight:700 }}>Total</span>
              <span style={{ color:C.yellow,fontWeight:900,fontSize:20,fontFamily:"'DM Mono',monospace" }}>₹{totalQuotAmt.toLocaleString()}</span>
            </div>
          </div>
        </ChartCard>
        <ChartCard title="📝 AMC Offer — Amount by Status">
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {amcOfferStatusData.map(a=>(
              <div key={a.name} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:a.bg,borderRadius:9,border:`1px solid ${a.color}33` }}>
                <span style={{ color:C.textDim,fontSize:13 }}>{a.name}</span>
                <span style={{ color:a.color,fontWeight:800,fontSize:18,fontFamily:"'DM Mono',monospace" }}>₹{a.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:C.orangeBg,borderRadius:9,border:`1px solid ${C.orange}44` }}>
              <span style={{ color:C.text,fontWeight:700 }}>Total</span>
              <span style={{ color:C.orange,fontWeight:900,fontSize:20,fontFamily:"'DM Mono',monospace" }}>₹{totalAmcOfferAmt.toLocaleString()}</span>
            </div>
          </div>
        </ChartCard>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
        <ChartCard title="💼 Technician — Closed Billing" empty={techBillData.length===0}>
          <ResponsiveContainer width="100%" height={230}><BarChart data={techBillData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis type="number" tick={{ fill:C.textMuted,fontSize:11 }} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><YAxis dataKey="name" type="category" tick={{ fill:C.textDim,fontSize:11 }} width={90}/><Tooltip {...ttp} formatter={v=>[`₹${v.toLocaleString()}`,"Amount"]}/><Bar dataKey="amount" fill={C.green} radius={[0,5,5,0]}/></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="💰 Billing by Type (Closed)">
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {[{label:"Spares",value:sparsAmt,color:C.yellow,bg:C.yellowBg},{label:"Service",value:serviceAmt,color:C.blue,bg:C.blueBg},{label:"GCL",value:gclAmt,color:C.purple,bg:C.purpleBg}].map(f=>(
              <div key={f.label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:f.bg,borderRadius:9,border:`1px solid ${f.color}33` }}>
                <span style={{ color:C.textDim,fontSize:13 }}>{f.label}</span>
                <span style={{ color:f.color,fontWeight:800,fontSize:18,fontFamily:"'DM Mono',monospace" }}>₹{f.value.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:C.greenBg,borderRadius:9,border:`1px solid ${C.green}44` }}>
              <span style={{ color:C.text,fontWeight:700 }}>Total Closed</span>
              <span style={{ color:C.green,fontWeight:900,fontSize:20,fontFamily:"'DM Mono',monospace" }}>₹{(sparsAmt+serviceAmt+gclAmt).toLocaleString()}</span>
            </div>
          </div>
        </ChartCard>
      </div>
      <div style={{ background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:C.shadow }}>
        <div style={{ padding:"14px 20px",borderBottom:`1px solid ${C.border}`,fontWeight:700,fontSize:15,color:C.text,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span>✅ Vinod Sir Approval</span>
          <button onClick={()=>exportToCSV(fVinod,vinodCols,"VinodApproval"+(selectedMonth?"_"+selectedMonth:""))} style={{ background:C.green,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:12 }}>⬇ Download CSV</button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead><tr>{["Sr","Customer","ESN","Complaint","Date","Status"].map(h=><th key={h} style={mkTh()}>{h}</th>)}</tr></thead>
            <tbody>
              {fVinod.length===0
                ? <tr><td colSpan={6} style={{ ...mkTd(),textAlign:"center",color:C.textMuted,padding:32 }}>No records</td></tr>
                : sortByDate(fVinod).map((r,i)=>(
                  <tr key={r.id} style={{ background:i%2===0?C.surface:C.surfaceAlt }}>
                    <td style={mkTd()}>{i+1}</td><td style={mkTd()}>{r.customer}</td><td style={mkTd()}>{r.esn}</td><td style={mkTd()}>{r.complaintType}</td><td style={mkTd()}>{r.date}</td>
                    <td style={mkTd()}><BadgeCell val={r.status} map="openClose"/></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MONTH PICKER ─────────────────────────────────────────────────────────────
function MonthPicker({ selectedMonth, setSelectedMonth, data }) {
  const now=new Date(); const start=new Date(2026,0,1); const fixedMonths=[]; const d=new Date(start);
  while(d<=now){ const val=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; fixedMonths.push(val); d.setMonth(d.getMonth()+1); }
  const allRows=data?Object.values(data).flat():[];
  const extraMonths=new Set();
  allRows.forEach(r=>{ const ds=r.date||r.from||""; if(ds&&ds.length>=7){ const mo=ds.slice(0,7); if(!fixedMonths.includes(mo)) extraMonths.add(mo); } });
  const allMonths=[...new Set([...fixedMonths,...Array.from(extraMonths)])].sort();
  return (
    <div style={{ padding:"10px 12px", borderBottom:`1px solid ${C.border}`, background:C.surfaceAlt }}>
      <div style={{ fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6 }}>📅 Filter by Month</div>
      <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ ...mkSel(),fontSize:12,padding:"6px 8px" }}>
        <option value="">All Months</option>
        {allMonths.map(m=>{ const [yr,mo]=m.split("-"); return <option key={m} value={m}>{MONTHS[parseInt(mo)-1]} {yr}</option>; })}
      </select>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const ADMIN_TABS=[{id:"totalVisit",label:"Total Visit",icon:"📋"},{id:"courtesyVisit",label:"Courtesy Visit",icon:"🤝"},{id:"amc",label:"AMC",icon:"🔄"},{id:"quotation",label:"Quotation Sent",icon:"📄"},{id:"amcOffer",label:"AMC Offer",icon:"📝"},{id:"billing",label:"Billing",icon:"💰"},{id:"purchase",label:"Total Purchase",icon:"🛒"},{id:"vinodApproval",label:"Vinod Sir Approval",icon:"✅"}];
const VIEWER_TABS=[{id:"dashboard",label:"CEO Dashboard",icon:"⚡"},...ADMIN_TABS];

function Sidebar({ user,tabs,active,setActive,onLogout,selectedMonth,setSelectedMonth,data }) {
  const isViewer=user.role==="viewer";
  const isAdmin=user.role==="admin";
  return (
    <div style={{ width:230,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,height:"100vh",position:"sticky",top:0 }}>
      {/* Header */}
      <div style={{ padding:"18px 16px 14px",background:`linear-gradient(135deg,#312e81 0%,#4338ca 60%,#6366f1 100%)`,position:"relative",overflow:"hidden",flexShrink:0 }}>
        <div style={{ position:"absolute",top:-30,right:-30,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.05)" }}/>
        <div style={{ fontSize:24,marginBottom:4 }}>⚙️</div>
        <div style={{ fontWeight:900,fontSize:13,color:"#fff",letterSpacing:"0.08em" }}>PRABHAT DIESELS</div>
        <div style={{ fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:1 }}>પ્રભાત ડીઝલ</div>
      </div>

      {/* User info */}
      <div style={{ padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,background:C.surfaceAlt,flexShrink:0 }}>
        <div style={{ width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${C.accent},${C.accentHover})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:14,flexShrink:0 }}>{user.name[0]}</div>
        <div style={{ overflow:"hidden",flex:1 }}>
          <div style={{ fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{user.name}</div>
          <div style={{ fontSize:10,fontWeight:600,color:isViewer?C.blue:C.orange,textTransform:"uppercase",letterSpacing:"0.05em" }}>{isViewer?"CEO · Viewer":"Admin"}</div>
        </div>
        {/* Logout button — upar */}
        <button onClick={onLogout} title="Logout"
          style={{ width:30,height:30,borderRadius:8,background:C.redBg,border:`1px solid ${C.red}44`,color:C.red,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          🚪
        </button>
      </div>

      {/* Month picker — for both admin and viewer */}
      <MonthPicker selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} data={data}/>

      {/* Nav */}
      <nav style={{ flex:1,padding:"8px 8px",overflowY:"auto" }}>
        <div style={{ fontSize:9,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",padding:"4px 8px 6px" }}>Navigation</div>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActive(t.id)}
            style={{ width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:2,
              background:active===t.id?C.accentBg:"transparent",
              color:active===t.id?C.accent:C.textMuted,
              fontWeight:active===t.id?700:500,fontSize:13,transition:"all 0.15s" }}>
            <span style={{ fontSize:15,flexShrink:0 }}>{t.icon}</span>
            <span style={{ flex:1 }}>{t.label}</span>
            {active===t.id && <span style={{ width:6,height:6,borderRadius:"50%",background:C.accent,flexShrink:0 }}/>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding:"10px 12px", borderTop:`1px solid ${C.border}`, textAlign:"center", flexShrink:0 }}>
        <div style={{ fontSize:10, color:C.textMuted, letterSpacing:"0.05em" }}>
          Designed & Developed by
        </div>
        <div style={{ fontSize:12, fontWeight:800, color:C.accent, letterSpacing:"0.1em", marginTop:2 }}>
          ✦ SKY ✦
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email,setEmail]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const go=async()=>{
    setErr(""); setLoading(true);
    try {
      const cred=await signInWithEmailAndPassword(auth,email,p);
      const info=ROLE_MAP[cred.user.email];
      if(!info){ await signOut(auth); setErr("Access denied."); setLoading(false); return; }
      onLogin({ email:cred.user.email, uid:cred.user.uid, ...info });
    } catch(e) { setErr("Invalid email or password."); }
    setLoading(false);
  };
  const inp=mkInp();
  return (
    <div style={{ minHeight:"100vh",display:"flex",background:C.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      {/* Left panel */}
      <div style={{ flex:1,background:`linear-gradient(145deg,#1e1b4b 0%,#312e81 40%,#4338ca 80%,#6366f1 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-80,left:-80,width:300,height:300,borderRadius:"50%",background:"rgba(255,255,255,0.04)" }}/>
        <div style={{ position:"absolute",bottom:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,0.03)" }}/>
        <div style={{ position:"relative",textAlign:"center",color:"#fff" }}>
          <div style={{ fontSize:60,marginBottom:16 }}>⚙️</div>
          <div style={{ fontWeight:900,fontSize:30,letterSpacing:"0.06em",marginBottom:6,fontFamily:"'DM Sans',sans-serif" }}>PRABHAT DIESELS</div>
          <div style={{ fontSize:20,opacity:0.7,marginBottom:4 }}>પ્રભાત ડીઝલ</div>
          <div style={{ fontSize:13,opacity:0.5,marginTop:10,maxWidth:260,lineHeight:1.7 }}>Diesel Engine Repair Service<br/>Management Portal</div>
          <div style={{ display:"flex",gap:24,marginTop:40,justifyContent:"center" }}>
            {[["📋","Track Visits"],["🔄","Manage AMC"],["💰","Billing"]].map(([icon,label])=>(
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ width:46,height:46,borderRadius:14,background:"rgba(255,255,255,0.1)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 6px",border:"1px solid rgba(255,255,255,0.15)" }}>{icon}</div>
                <div style={{ fontSize:11,opacity:0.6 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Right panel */}
      <div style={{ width:440,display:"flex",alignItems:"center",justifyContent:"center",padding:48,background:C.bg }}>
        <div style={{ width:"100%" }}>
          <div style={{ marginBottom:32 }}>
            <div style={{ fontWeight:900,fontSize:26,color:C.text,marginBottom:6,letterSpacing:"-0.02em" }}>Welcome back</div>
            <div style={{ color:C.textMuted,fontSize:14 }}>Sign in to your account</div>
          </div>
          <div style={{ marginBottom:18 }}>
            <label style={{ fontSize:11,fontWeight:700,color:C.textMuted,display:"block",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.07em" }}>Email</label>
            <input style={{ ...inp,padding:"13px 16px",borderRadius:10,fontSize:14,background:C.surface,border:`1.5px solid ${C.border}` }} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
          </div>
          <div style={{ marginBottom:28 }}>
            <label style={{ fontSize:11,fontWeight:700,color:C.textMuted,display:"block",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.07em" }}>Password</label>
            <input style={{ ...inp,padding:"13px 16px",borderRadius:10,fontSize:14,background:C.surface,border:`1.5px solid ${C.border}` }} type="password" placeholder="••••••••" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
          </div>
          {err && <div style={{ background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:18 }}>⚠️ {err}</div>}
          <button onClick={go} disabled={loading}
            style={{ width:"100%",padding:15,background:`linear-gradient(135deg,#4338ca,#6366f1)`,color:"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:loading?"wait":"pointer",opacity:loading?0.75:1,boxShadow:"0 4px 20px rgba(99,102,241,0.45)",letterSpacing:"0.02em" }}>
            {loading?"Signing in…":"Sign In →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [data,setData]=useState(initData);
  const [active,setActive]=useState(null);
  const [selectedMonth,setSelectedMonth]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth, async(fireUser)=>{
      if(fireUser){
        const info=ROLE_MAP[fireUser.email];
        if(info){ setUser({email:fireUser.email,uid:fireUser.uid,...info}); setActive(info.role==="admin"?"totalVisit":"dashboard"); }
        else { await signOut(auth); }
      } else { setUser(null); setActive(null); }
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{ if(user){ loadFromFirestore().then(d=>setData(d)); } },[user]);

  useEffect(()=>{
    if(!user) return;
    const timer=setTimeout(()=>{ saveToFirestore(data); },1500);
    return ()=>clearTimeout(timer);
  },[data,user]);

  const login=(u)=>{ setUser(u); setActive(u.role==="admin"?"totalVisit":"dashboard"); };
  const logout=async()=>{ await signOut(auth); setUser(null); setActive(null); setData(initData()); };

  if(loading) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,flexDirection:"column",gap:16 }}>
      <div style={{ fontSize:40 }}>⚙️</div>
      <div style={{ color:C.textMuted,fontSize:14 }}>Loading Prabhat Diesels…</div>
    </div>
  );
  if(!user) return <LoginPage onLogin={login}/>;

  const isAdmin=user.role==="admin";
  const tabs=isAdmin?ADMIN_TABS:VIEWER_TABS;
  // Both admin and viewer get selectedMonth passed
  const pageProps={data,setData,isAdmin,selectedMonth};

  const content=()=>{
    if(!isAdmin&&active==="dashboard") return <CeoDashboard data={data} selectedMonth={selectedMonth}/>;
    switch(active){
      case "totalVisit":    return <TotalVisitPage    {...pageProps}/>;
      case "courtesyVisit": return <CourtesyVisitPage {...pageProps}/>;
      case "amc":           return <AmcPage           {...pageProps}/>;
      case "quotation":     return <QuotationPage     {...pageProps}/>;
      case "amcOffer":      return <AmcOfferPage      {...pageProps}/>;
      case "billing":       return <BillingPage       {...pageProps}/>;
      case "purchase":      return <PurchasePage      {...pageProps}/>;
      case "vinodApproval": return <VinodApprovalPage {...pageProps}/>;
      default: return null;
    }
  };

  return (
    <div style={{ display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",fontSize:14,overflow:"hidden" }}>
      <Sidebar user={user} tabs={tabs} active={active} setActive={setActive} onLogout={logout} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} data={data}/>
      <main style={{ flex:1,overflowY:"auto",height:"100vh" }}>{content()}</main>
    </div>
  );
}
