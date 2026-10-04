import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ParentAccounts() {
  const [groups,setGroups]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [phone,setPhone]=useState(""),[parentName,setParentName]=useState(""),[pin,setPin]=useState(""),[busy,setBusy]=useState(false),[search,setSearch]=useState("");

  const load=async()=>{setLoading(true);try{const {data,error}=await supabase.functions.invoke("parent-accounts",{body:{action:"list"}});if(error)throw error;if(data?.error)throw new Error(data.error);setGroups(Array.isArray(data)?data:[]);}catch(e){setError(e.message||"Unable to load parent accounts.");}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);

  const filteredGroups=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return groups;return groups.filter(g=>[g.parentName,g.phone,...(g.students||[]).map(s=>s.name)].some(v=>String(v||"").toLowerCase().includes(q)));},[groups,search]);

  const action=async(type,p)=>{setBusy(true);setError("");setMessage("");try{const body={action:type,phone:p.phone};if(type==="create"){if(!/^\d{6}$/.test(pin))throw new Error("PIN must be exactly 6 digits.");body.pin=pin;body.parentName=parentName.trim();}const {data,error}=await supabase.functions.invoke("parent-accounts",{body});if(error)throw error;if(data?.error)throw new Error(data.error);if(data?.pin)setMessage((type==="create"?"Temporary PIN: ":"New PIN: ")+data.pin);else setMessage("Parent account updated.");setPin("");setParentName("");await load();}catch(e){setError(e.message||"Action failed.");}finally{setBusy(false);}};

  return <div className="page">
    <style>{"@media(max-width:700px){.meka-parent-settings-grid{grid-template-columns:1fr!important}.meka-parent-security-row{flex-direction:column!important;align-items:flex-start!important}.meka-parent-actions{width:100%!important}.meka-parent-actions button{flex:1!important}.meka-parent-settings-section{padding:16px!important}.meka-parent-settings-header{gap:8px!important}.meka-parent-settings-header h2{font-size:18px!important}.meka-parent-search{width:100%!important}}"}</style>
    <div className="page-header"><div><h1>Parent Accounts</h1><p>Manage parent phone + PIN access.</p></div></div>
    {error&&<div className="auth-error">{error}</div>}{message&&<div className="auth-success">{message}</div>}

    <section className="settings-section meka-parent-settings-section">
      <div className="settings-section-header meka-parent-settings-header"><div><h2>Create Parent Account</h2><p>Phone must already be linked to a student.</p></div></div>
      <div className="settings-form-grid meka-parent-settings-grid">
        <div className="settings-field"><label>Parent phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="08012345678"/></div>
        <div className="settings-field"><label>Parent name</label><input value={parentName} onChange={e=>setParentName(e.target.value)} /></div>
        <div className="settings-field"><label>6-digit PIN</label><input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} maxLength={6} inputMode="numeric"/></div>
      </div>
      <div className="settings-editor-actions"><button className="primary-btn" disabled={busy} onClick={()=>action("create",{phone})}>{busy?"Working...":"Create Parent Account"}</button></div>
    </section>

    <section className="settings-section">
      <div className="settings-section-header"><div><h2>Parent Access</h2><p>Parents only see children linked to their phone number.</p></div></div>
      {!loading&&groups.length>0&&<div className="settings-field meka-parent-search" style={{marginBottom:16,maxWidth:520}}><label>Search parents</label><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by parent name, phone, or student name" /></div>}
      {loading?<p>Loading...</p>:groups.length===0?<p>No parent phone numbers found.</p>:filteredGroups.length===0?<p>No parents match "{search}".</p>:<div className="settings-security-list">{filteredGroups.map(g=><div className="security-row meka-parent-security-row" key={g.phone}><div><strong>{g.parentName||"Parent"}</strong><small style={{display:"block"}}>{g.phone} · {g.students.map(s=>s.name).join(", ")}</small></div><div className="meka-parent-actions" style={{display:"flex",gap:8,flexWrap:"wrap"}}>{g.account?<><span className={"settings-badge "+(g.account.status==="Active"?"ready":"locked")}>{g.account.status}</span><button className="secondary-btn" disabled={busy} onClick={()=>action("reset",g)}>Reset PIN</button>{g.account.status==="Active"?<button className="secondary-btn" disabled={busy} onClick={()=>action("disable",g)}>Disable</button>:<button className="secondary-btn" disabled={busy} onClick={()=>action("enable",g)}>Enable</button>}</>:<button className="primary-btn" disabled={busy} onClick={()=>{setPhone(g.phone);setParentName(g.parentName||"");window.scrollTo({top:0,behavior:"smooth"});}}>Set up</button>}</div></div>)}</div>}
    </section>
  </div>;
}
