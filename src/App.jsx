import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── ROLE MAP (email → role/name) ────────────────────────────────────────────
const ROLE_MAP = {
  "juhi@prabhatdiesels.com":  { role: "admin",  name: "Juhi Yadav"  },
  "akash@prabhatdiesels.com": { role: "viewer", name: "Akash Sharma" },
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const initData = () => ({ totalVisit:[], courtesyVisit:[], amc:[], quotation:[], amcOffer:[], billing:[], purchase:[], vinodApproval:[] });
const genId     = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const getAmcStatus = (to) => { if (!to) return "-"; return new Date(to) >= new Date() ? "Active" : "Expired"; };

// ─── FIRESTORE LOAD/SAVE ──────────────────────────────────────────────────────
const loadFromFirestore = async () => {
  try {
    const ref = doc(db, "appdata", "main");
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    return initData();
  } catch (e) {
    console.error("Load error:", e);
    return initData();
  }
};

const saveToFirestore = async (data) => {
  try {
    const ref = doc(db, "appdata", "main");
    await setDoc(ref, data);
  } catch (e) {
    console.error("Save error:", e);
  }
};

// ─── LIGHT THEME ──────────────────────────────────────────────────────────────
const C = {
  bg:"#f4f6fb", surface:"#ffffff", surfaceAlt:"#f8f9fc", border:"#e2e8f0", borderDark:"#cbd5e1",
  accent:"#2563eb", accentHover:"#1d4ed8", accentBg:"#eff6ff", accentDim:"#93c5fd",
  text:"#0f172a", textMuted:"#64748b", textDim:"#334155",
  green:"#16a34a", greenBg:"#f0fdf4", greenBorder:"#bbf7d0",
  red:"#dc2626", redBg:"#fef2f2", redBorder:"#fecaca",
  blue:"#2563eb", blueBg:"#eff6ff", blueBorder:"#bfdbfe",
  yellow:"#d97706", yellowBg:"#fffbeb", yellowBorder:"#fde68a",
  purple:"#7c3aed", purpleBg:"#f5f3ff", purpleBorder:"#ddd6fe",
  orange:"#ea580c", orangeBg:"#fff7ed", orangeBorder:"#fed7aa",
  shadow:"0 1px 3px rgba(0,0,0,0.07)", shadowMd:"0 4px 6px rgba(0,0,0,0.07)", shadowLg:"0 10px 40px rgba(0,0,0,0.12)",
};

const PIE_COLORS = ["#1d6fde","#15803d","#b91c1c","#a16207","#6d28d9","#c2410c"];
const mkInp = () => ({ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:7, color:C.text, padding:"7px 10px", width:"100%", outline:"none", fontSize:13, boxSizing:"border-box" });
const mkSel = () => ({ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:7, color:C.text, padding:"7px 10px", outline:"none", fontSize:13, cursor:"pointer", width:"100%" });
const mkTh  = () => ({ background:C.surfaceAlt, color:C.textMuted, padding:"10px 12px", textAlign:"left", borderBottom:`1.5px solid ${C.border}`, fontWeight:700, textTransform:"uppercase", fontSize:10, letterSpacing:"0.06em", whiteSpace:"nowrap" });
const mkTd  = () => ({ padding:"9px 12px", borderBottom:`1px solid ${C.border}`, color:C.textDim, verticalAlign:"middle" });

const badge = (bg, color, text) => (
  <span style={{ background:bg, color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 11px", fontSize:11, fontWeight:700, display:"inline-block", whiteSpace:"nowrap" }}>{text}</span>
);

const BADGE_MAPS = {
  visitType:  { BD:[C.blueBg,C.blue,"BD"], AMC:[C.greenBg,C.green,"AMC"], GCL:[C.purpleBg,C.purple,"GCL"] },
  amcType:    { GCL:[C.purpleBg,C.purple,"GCL"], Prabhat:[C.orangeBg,C.orange,"Prabhat"] },
  amcStatus:  { Active:[C.greenBg,C.green,"Active"], Expired:[C.redBg,C.red,"Expired"], "-":["#f8fafc",C.textMuted,"—"] },
  qType:      { service:[C.blueBg,C.blue,"Service"], parts:[C.yellowBg,C.yellow,"Parts"] },
  qStatus:    { infollowing:[C.blueBg,C.blue,"In Following"], approved:[C.greenBg,C.green,"Approved"], "need higher authorized":[C.redBg,C.red,"Need Higher Auth"] },
  billType:   { spars:[C.yellowBg,C.yellow,"Spars"], service:[C.blueBg,C.blue,"Service"], GCL:[C.purpleBg,C.purple,"GCL"] },
  openClose:  { open:[C.orangeBg,C.orange,"Open"], close:[C.greenBg,C.green,"Close"] },
};

function BadgeCell({ val, map }) {
  const m = BADGE_MAPS[map]?.[val];
  if (!m) return <span style={{ color:C.textMuted }}>—</span>;
  return badge(m[0], m[1], m[2]);
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const filterByMonth = (rows, month) => {
  if (!month) return rows;
  const [yr, mo] = month.split("-");
  return rows.filter(r => { const d = r.date || r.from || ""; if (!d) return false; const [ry,rm] = d.split("-"); return ry===yr && rm===mo; });
};

function exportToCSV(rows, columns, filename) {
  if (!rows.length) { alert("No data to export!"); return; }
  const headers = columns.filter(c=>c.key!=="srno").map(c=>c.label);
  const dataRows = rows.map(row => columns.filter(c=>c.key!=="srno").map(c => { if(c.key==="amcStatus") return getAmcStatus(row.to); return row[c.key]||""; }));
  const csv = [headers,...dataRows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename+".csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── EDITABLE TABLE ───────────────────────────────────────────────────────────
function EditableTable({ columns, rows, isAdmin, onAdd, onUpdate, onDelete, selectedMonth, exportFilename }) {
  const [newRow, setNewRow] = useState({});
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const th=mkTh(); const td=mkTd(); const inp=mkInp(); const sel=mkSel();
  const displayRows = selectedMonth ? filterByMonth(rows, selectedMonth) : rows;

  return (
    <div>
      {!isAdmin && exportFilename && (
        <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end" }}>
          <button onClick={()=>exportToCSV(displayRows,columns,exportFilename+(selectedMonth?"_"+selectedMonth:""))}
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
            {displayRows.map((row,i)=>(
              <tr key={row.id} style={{ background:i%2===0?"#fff":C.surfaceAlt }}>
                {columns.map(c=>(
                  <td key={c.key} style={td}>
                    {editId===row.id && isAdmin && c.key!=="srno" && c.key!=="amcStatus" ? (
                      c.type==="select"
                        ? <select style={sel} value={editRow[c.key]||""} onChange={e=>setEditRow(r=>({...r,[c.key]:e.target.value}))}><option value="">Select</option>{c.options.map(o=><option key={o} value={o}>{o}</option>)}</select>
                        : <input style={inp} type={c.inputType||"text"} value={editRow[c.key]??""} onChange={e=>setEditRow(r=>({...r,[c.key]:e.target.value}))}/>
                    ) : c.key==="srno" ? (
                      <span style={{ color:C.textMuted, fontWeight:600 }}>{i+1}</span>
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
                          <button style={{ background:C.border, color:C.textMuted, border:"none", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11 }} onClick={()=>setEditId(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button style={{ background:C.blueBg, color:C.blue, border:"none", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:700 }} onClick={()=>{ setEditId(row.id); setEditRow({...row}); }}>Edit</button>
                          <button style={{ background:C.redBg, color:C.red, border:"none", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:700 }} onClick={()=>{ if(window.confirm("Delete this record?")) onDelete(row.id); }}>Del</button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {isAdmin && (
              <tr style={{ background:C.accentBg }}>
                {columns.map(c=>(
                  <td key={c.key} style={td}>
                    {c.key==="srno" ? <span style={{ color:C.textMuted }}>{rows.length+1}</span>
                      : c.key==="amcStatus" ? <span style={{ color:C.textMuted, fontSize:12 }}>Auto</span>
                      : c.type==="select"
                        ? <select style={sel} value={newRow[c.key]||""} onChange={e=>setNewRow(r=>({...r,[c.key]:e.target.value}))}><option value="">Select</option>{c.options.map(o=><option key={o} value={o}>{o}</option>)}</select>
                        : <input style={inp} type={c.inputType||"text"} placeholder={c.label} value={newRow[c.key]||""} onChange={e=>setNewRow(r=>({...r,[c.key]:e.target.value}))}/>
                    }
                  </td>
                ))}
                <td style={td}><button style={{ background:C.accent, color:"#fff", border:"none", borderRadius:7, padding:"7px 16px", cursor:"pointer", fontWeight:700, fontSize:13 }} onClick={()=>{ onAdd(newRow); setNewRow({}); }}>+ Add</button></td>
              </tr>
            )}
          </tbody>
        </table>
        {displayRows.length===0 && (
          <div style={{ textAlign:"center", padding:40, color:C.textMuted }}>{selectedMonth?`No records for ${selectedMonth}`:"No records found"}</div>
        )}
      </div>
    </div>
  );
}

function PageWrapper({ title, icon, count, children }) {
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:22 }}>
        <div style={{ width:48, height:48, background:`linear-gradient(135deg,${C.accent},#3b82f6)`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:`0 4px 12px ${C.accent}33` }}>{icon}</div>
        <div>
          <h2 style={{ margin:0, fontSize:21, fontWeight:800, color:C.text }}>{title}</h2>
          <div style={{ color:C.textMuted, fontSize:12, marginTop:3 }}>{count} record{count!==1?"s":""} total</div>
        </div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:"hidden", boxShadow:C.shadow }}>{children}</div>
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
const visitCols    = [{key:"srno",label:"Sr.No"},{key:"date",label:"Date",inputType:"date"},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"type",label:"Type",type:"select",options:["BD","AMC","GCL"],badge:"visitType"},{key:"technician",label:"Technician"},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"}];
const courtesyCols = [{key:"srno",label:"Sr.No"},{key:"date",label:"Date",inputType:"date"},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"location",label:"Location"},{key:"technician",label:"Technician"},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"}];
const amcCols      = [{key:"srno",label:"Sr.No"},{key:"esn",label:"ESN"},{key:"customer",label:"Customer"},{key:"type",label:"Type",type:"select",options:["GCL","Prabhat"],badge:"amcType"},{key:"from",label:"From",inputType:"date"},{key:"to",label:"To",inputType:"date"},{key:"amcStatus",label:"Status"}];
const quotCols     = [{key:"srno",label:"Sr.No"},{key:"date",label:"Date",inputType:"date"},{key:"quotationNo",label:"Quotation No."},{key:"customer",label:"Customer"},{key:"type",label:"Type",type:"select",options:["service","parts"],badge:"qType"},{key:"amount",label:"Amount",inputType:"number"},{key:"status",label:"Status",type:"select",options:["infollowing","approved","need higher authorized"],badge:"qStatus"},{key:"technician",label:"Technician"}];
const amcOfferCols = [{key:"srno",label:"Sr.No"},{key:"date",label:"Date",inputType:"date"},{key:"esn",label:"ESN"},{key:"customer",label:"Customer"},{key:"amount",label:"Amount",inputType:"number"},{key:"status",label:"Status",type:"select",options:["infollowing","approved","need higher authorized"],badge:"qStatus"},{key:"technician",label:"Technician"}];
const billingCols  = [{key:"srno",label:"Sr.No"},{key:"date",label:"Date",inputType:"date"},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"type",label:"Type",type:"select",options:["spars","service","GCL"],badge:"billType"},{key:"quotation",label:"Quotation No."},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"},{key:"technician",label:"Technician"},{key:"amount",label:"Amount",inputType:"number"}];
const purchaseCols = [{key:"srno",label:"Sr.No"},{key:"date",label:"Date",inputType:"date"},{key:"customer",label:"Customer"},{key:"amount",label:"Amount",inputType:"number"}];
const vinodCols    = [{key:"srno",label:"Sr.No"},{key:"customer",label:"Customer"},{key:"esn",label:"ESN"},{key:"complaintType",label:"Complaint Type"},{key:"date",label:"Date",inputType:"date"},{key:"status",label:"Status",type:"select",options:["open","close"],badge:"openClose"}];

// ─── PAGE COMPONENTS ──────────────────────────────────────────────────────────
function TotalVisitPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("totalVisit",data,setData);
  return <PageWrapper title="Total Visit" icon="📋" count={rows.length}><EditableTable columns={visitCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="TotalVisit"/></PageWrapper>;
}
function CourtesyVisitPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("courtesyVisit",data,setData);
  return <PageWrapper title="Total Courtesy Visit" icon="🤝" count={rows.length}><EditableTable columns={courtesyCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="CourtesyVisit"/></PageWrapper>;
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
        <div style={{ width:44,height:44,background:C.accentBg,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>🔄</div>
        <div><h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.text }}>AMC</h2><div style={{ color:C.textMuted,fontSize:12 }}>{rows.length} records</div></div>
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
            {pieData.length>0 ? (
              <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>{pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}</Pie><Tooltip {...ttp}/></PieChart></ResponsiveContainer>
            ) : <div style={{ textAlign:"center",padding:40,color:C.textMuted }}>No data yet</div>}
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
  return <PageWrapper title="Quotation Sent" icon="📄" count={rows.length}><EditableTable columns={quotCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="Quotation"/></PageWrapper>;
}
function AmcOfferPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onAdd,onUpdate,onDelete}=useTableOps("amcOffer",data,setData);
  return <PageWrapper title="AMC Offer" icon="📝" count={rows.length}><EditableTable columns={amcOfferCols} rows={rows} isAdmin={isAdmin} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="AMCOffer"/></PageWrapper>;
}
function BillingPage({ data,setData,isAdmin,selectedMonth }) {
  const {rows,onUpdate,onDelete}=useTableOps("billing",data,setData);
  const quotations=data.quotation;
  const autoQ=(customer)=>quotations.find(q=>q.customer?.toLowerCase()===customer?.toLowerCase())?.quotationNo||"";
  const handleAdd=(row)=>setData(d=>({...d,billing:[...d.billing,{id:genId(),...row,quotation:autoQ(row.customer)}]}));
  const handleUpdate=(id,upd)=>onUpdate(id,{...upd,quotation:autoQ(upd.customer)});
  return (
    <PageWrapper title="Billing" icon="💰" count={rows.length}>
      {isAdmin && <div style={{ background:"#fffbeb",borderBottom:`1px solid #fde68a`,padding:"9px 16px",fontSize:12,color:C.yellow }}>💡 Quotation No. auto-fills from "Quotation Sent"</div>}
      <EditableTable columns={billingCols} rows={rows} isAdmin={isAdmin} onAdd={handleAdd} onUpdate={handleUpdate} onDelete={onDelete} selectedMonth={selectedMonth} exportFilename="Billing"/>
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
      <div style={{ fontSize:24,fontWeight:900,color:C.text,lineHeight:1 }}>{value}</div>
      <div style={{ color:C.textMuted,fontSize:12,marginTop:5,fontWeight:500 }}>{label}</div>
    </div>
  );
}
function ChartCard({ title,children,empty }) {
  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:24,boxShadow:C.shadow }}>
      <div style={{ fontWeight:700,marginBottom:18,fontSize:14,color:C.text,paddingBottom:14,borderBottom:`1px solid ${C.border}` }}>{title}</div>
      {empty?<div style={{ textAlign:"center",padding:44,color:C.textMuted,fontSize:13 }}>No data yet</div>:children}
    </div>
  );
}
function CeoDashboard({ data,selectedMonth }) {
  const {totalVisit:tv,courtesyVisit:cv,amc,quotation:quot,billing,purchase,amcOffer,vinodApproval}=data;
  const ttp={contentStyle:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}};
  const fTv=selectedMonth?filterByMonth(tv,selectedMonth):tv;
  const fCv=selectedMonth?filterByMonth(cv,selectedMonth):cv;
  const fQuot=selectedMonth?filterByMonth(quot,selectedMonth):quot;
  const fBill=selectedMonth?filterByMonth(billing,selectedMonth):billing;
  const fPurch=selectedMonth?filterByMonth(purchase,selectedMonth):purchase;
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
  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ margin:0,fontSize:22,fontWeight:900,color:C.text }}>⚡ CEO Dashboard</h2>
        <p style={{ color:C.textMuted,margin:"4px 0 0",fontSize:13 }}>Prabhat Diesels • Live Overview {selectedMonth && <span style={{ marginLeft:10,background:C.accentBg,color:C.accent,borderRadius:20,padding:"2px 12px",fontSize:12,fontWeight:700 }}>📅 {selectedMonth}</span>}</p>
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
                <tr key={r.type}><td style={td}><BadgeCell val={r.type} map="visitType"/></td><td style={{ ...td,fontWeight:800,fontSize:20,color:C.text }}>{r.count}</td><td style={{ ...td,color:C.textMuted }}>{fTv.length>0?((r.count/fTv.length)*100).toFixed(1)+"%":"—"}</td></tr>
              ))}
              <tr style={{ borderTop:`2px solid ${C.border}` }}><td style={{ ...td,fontWeight:700,color:C.text }}>Total</td><td style={{ ...td,fontWeight:900,fontSize:20,color:C.accent }}>{fTv.length}</td><td style={{ ...td,color:C.textMuted }}>100%</td></tr>
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
                <span style={{ color:q.color,fontWeight:800,fontSize:18 }}>₹{q.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:C.yellowBg,borderRadius:9,border:`1px solid ${C.yellow}44` }}>
              <span style={{ color:C.text,fontWeight:700 }}>Total</span>
              <span style={{ color:C.yellow,fontWeight:900,fontSize:20 }}>₹{totalQuotAmt.toLocaleString()}</span>
            </div>
          </div>
        </ChartCard>
        <ChartCard title="📝 AMC Offer — Amount by Status">
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {amcOfferStatusData.map(a=>(
              <div key={a.name} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:a.bg,borderRadius:9,border:`1px solid ${a.color}33` }}>
                <span style={{ color:C.textDim,fontSize:13 }}>{a.name}</span>
                <span style={{ color:a.color,fontWeight:800,fontSize:18 }}>₹{a.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:C.orangeBg,borderRadius:9,border:`1px solid ${C.orange}44` }}>
              <span style={{ color:C.text,fontWeight:700 }}>Total</span>
              <span style={{ color:C.orange,fontWeight:900,fontSize:20 }}>₹{totalAmcOfferAmt.toLocaleString()}</span>
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
                <span style={{ color:f.color,fontWeight:800,fontSize:18 }}>₹{f.value.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:C.greenBg,borderRadius:9,border:`1px solid ${C.green}44` }}>
              <span style={{ color:C.text,fontWeight:700 }}>Total Closed</span>
              <span style={{ color:C.green,fontWeight:900,fontSize:20 }}>₹{(sparsAmt+serviceAmt+gclAmt).toLocaleString()}</span>
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
                : fVinod.map((r,i)=>(
                  <tr key={r.id} style={{ background:i%2===0?"#fff":C.surfaceAlt }}>
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
function MonthPicker({ selectedMonth,setSelectedMonth,data }) {
  const now=new Date(); const start=new Date(2026,0,1); const fixedMonths=[]; const d=new Date(start);
  while(d<=now){ const val=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; fixedMonths.push(val); d.setMonth(d.getMonth()+1); }
  const allRows=data?Object.values(data).flat():[];
  const extraMonths=new Set();
  allRows.forEach(r=>{ const ds=r.date||r.from||""; if(ds&&ds.length>=7){ const mo=ds.slice(0,7); if(!fixedMonths.includes(mo)) extraMonths.add(mo); } });
  const allMonths=[...new Set([...fixedMonths,...Array.from(extraMonths)])].sort();
  return (
    <div style={{ padding:"10px 12px",borderBottom:`1px solid ${C.border}`,background:C.surfaceAlt }}>
      <div style={{ fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6 }}>📅 Filter by Month</div>
      <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ ...mkSel(),fontSize:12,padding:"6px 8px",background:"#fff" }}>
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
  return (
    <div style={{ width:230,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0 }}>
      <div style={{ padding:"22px 20px 18px",background:"linear-gradient(135deg,#1e40af 0%,#2563eb 60%,#3b82f6 100%)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.08)" }}/>
        <div style={{ fontSize:26,marginBottom:6 }}>⚙️</div>
        <div style={{ fontWeight:900,fontSize:13,color:"#fff",letterSpacing:"0.06em" }}>PRABHAT DIESELS</div>
        <div style={{ fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2 }}>પ્રભાત ડીઝલ</div>
      </div>
      <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,background:C.surfaceAlt }}>
        <div style={{ width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.accent},#3b82f6)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:15,flexShrink:0 }}>{user.name[0]}</div>
        <div style={{ overflow:"hidden" }}>
          <div style={{ fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{user.name}</div>
          <div style={{ fontSize:10,fontWeight:600,color:isViewer?C.blue:C.orange,textTransform:"uppercase" }}>{isViewer?"CEO · Viewer":"Admin"}</div>
        </div>
      </div>
      {isViewer && <MonthPicker selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} data={data}/>}
      <nav style={{ flex:1,padding:"10px",overflowY:"auto" }}>
        <div style={{ fontSize:9,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",padding:"4px 8px 8px" }}>Navigation</div>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActive(t.id)} style={{ width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:9,padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:2,background:active===t.id?C.accentBg:"transparent",color:active===t.id?C.accent:C.textMuted,fontWeight:active===t.id?700:500,fontSize:13 }}>
            <span style={{ fontSize:15 }}>{t.icon}</span>
            <span style={{ flex:1 }}>{t.label}</span>
            {active===t.id && <span style={{ width:6,height:6,borderRadius:"50%",background:C.accent,flexShrink:0 }}/>}
          </button>
        ))}
      </nav>
      <div style={{ padding:"12px 10px",borderTop:`1px solid ${C.border}` }}>
        <button onClick={onLogout} style={{ width:"100%",padding:"9px 12px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.textMuted,cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,justifyContent:"center" }}>
          🚪 <span>Logout</span>
        </button>
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
    } catch(e) {
      setErr("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };
  const inp=mkInp();
  return (
    <div style={{ minHeight:"100vh",display:"flex",background:"#f4f6fb" }}>
      <div style={{ flex:1,background:"linear-gradient(145deg,#1e40af 0%,#2563eb 50%,#0ea5e9 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:48,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-60,left:-60,width:300,height:300,borderRadius:"50%",background:"rgba(255,255,255,0.05)" }}/>
        <div style={{ position:"relative",textAlign:"center",color:"#fff" }}>
          <div style={{ fontSize:56,marginBottom:16 }}>⚙️</div>
          <div style={{ fontWeight:900,fontSize:28,letterSpacing:"0.04em",marginBottom:8 }}>PRABHAT DIESELS</div>
          <div style={{ fontSize:18,opacity:0.8,marginBottom:6 }}>પ્રભાત ડીઝલ</div>
          <div style={{ fontSize:14,opacity:0.6,marginTop:12,maxWidth:280,lineHeight:1.6 }}>Diesel Engine Repair Service • Management Portal</div>
          <div style={{ display:"flex",gap:20,marginTop:36,justifyContent:"center" }}>
            {[["📋","Track Visits"],["🔄","Manage AMC"],["💰","Billing"]].map(([icon,label])=>(
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ width:44,height:44,borderRadius:12,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 6px" }}>{icon}</div>
                <div style={{ fontSize:11,opacity:0.7 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ width:420,display:"flex",alignItems:"center",justifyContent:"center",padding:48 }}>
        <div style={{ width:"100%" }}>
          <div style={{ marginBottom:32 }}>
            <div style={{ fontWeight:900,fontSize:24,color:C.text,marginBottom:6 }}>Welcome back</div>
            <div style={{ color:C.textMuted,fontSize:14 }}>Sign in to your account</div>
          </div>
          <div style={{ marginBottom:18 }}>
            <label style={{ fontSize:12,fontWeight:700,color:C.textDim,display:"block",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.05em" }}>Email</label>
            <input style={{ ...inp,padding:"12px 14px",borderRadius:10,fontSize:14 }} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:12,fontWeight:700,color:C.textDim,display:"block",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.05em" }}>Password</label>
            <input style={{ ...inp,padding:"12px 14px",borderRadius:10,fontSize:14 }} type="password" placeholder="Enter your password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
          </div>
          {err && <div style={{ background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:18 }}>⚠️ {err}</div>}
          <button onClick={go} disabled={loading} style={{ width:"100%",padding:14,background:"linear-gradient(135deg,#1e40af,#2563eb)",color:"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:loading?"wait":"pointer",opacity:loading?0.75:1,boxShadow:"0 4px 16px rgba(37,99,235,0.35)" }}>
            {loading?"Signing in...":"Sign In →"}
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

  // Auth listener
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

  // Load data from Firestore on login
  useEffect(()=>{
    if(user){ loadFromFirestore().then(d=>setData(d)); }
  },[user]);

  // Save data to Firestore on change (debounced)
  useEffect(()=>{
    if(!user) return;
    const timer=setTimeout(()=>{ saveToFirestore(data); },1500);
    return ()=>clearTimeout(timer);
  },[data,user]);

  const login=(u)=>{ setUser(u); setActive(u.role==="admin"?"totalVisit":"dashboard"); };
  const logout=async()=>{ await signOut(auth); setUser(null); setActive(null); setData(initData()); };

  if(loading) return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,flexDirection:"column",gap:16 }}><div style={{ fontSize:40 }}>⚙️</div><div style={{ color:C.textMuted,fontSize:14 }}>Loading Prabhat Diesels...</div></div>;
  if(!user) return <div style={{ background:C.bg,minHeight:"100vh" }}><LoginPage onLogin={login}/></div>;

  const isAdmin=user.role==="admin";
  const tabs=isAdmin?ADMIN_TABS:VIEWER_TABS;
  const pageProps={data,setData,isAdmin,selectedMonth:isAdmin?"":selectedMonth};

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
    <div style={{ display:"flex",minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",fontSize:14 }}>
      <Sidebar user={user} tabs={tabs} active={active} setActive={setActive} onLogout={logout} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} data={data}/>
      <main style={{ flex:1,overflowY:"auto",minHeight:"100vh" }}>{content()}</main>
    </div>
  );
}
