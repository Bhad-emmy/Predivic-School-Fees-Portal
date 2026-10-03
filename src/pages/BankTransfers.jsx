import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const money=(v)=>"₦"+Number(v||0).toLocaleString("en-NG",{minimumFractionDigits:2});

export default function BankTransfers(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busyId,setBusyId]=useState("");
  const [note,setNote]=useState("");
  const [selected,setSelected]=useState(null);
  const [proofBusyId,setProofBusyId]=useState("");

  const load=async()=>{
    setLoading(true);setError("");
    const {data,error:queryError}=await supabase.from("bank_transfer_submissions")
      .select("id,amount,transfer_reference,sender_name,proof_url,proof_path,status,created_at,review_note,students(first_name,middle_name,last_name,admission_no)")
      .order("created_at",{ascending:false});
    if(queryError){setError(queryError.message);setLoading(false);return;}
    setRows(data||[]);setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const review=async(id,decision)=>{
    setBusyId(id);setError("");
    const {data,error:rpcError}=await supabase.rpc("review_bank_transfer",{p_submission_id:id,p_decision:decision,p_review_note:note||null});
    if(rpcError){setError(rpcError.message);setBusyId("");return;}
    setNote("");
    setSelected(null);
    await load();
    setBusyId("");
    return data;
  };

  const pending=rows.filter(r=>r.status==="Pending Verification");
  return <div className="page">
    <div className="page-header"><div><h1>Bank Transfers</h1><p style={{color:"#64748b",marginTop:"4px"}}>Verify parent bank transfer submissions before they become paid.</p></div><button className="secondary-btn" onClick={load}>Refresh</button></div>
    {error&&<p style={{color:"#b91c1c",marginBottom:15}}>{error}</p>}
    {loading?<div className="page-card">Loading bank transfers...</div>:pending.length===0?<div className="page-card">No pending bank transfers.</div>:
      <div className="page-card" style={{overflowX:"auto"}}><table className="data-table"><thead><tr><th>Student</th><th>Amount</th><th>Reference</th><th>Sender</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {rows.map(r=>{const s=r.students||{};const name=[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(" ")||"Unknown";return <tr key={r.id}><td><strong>{name}</strong><div style={{fontSize:12,color:"#64748b"}}>{s.admission_no||""}</div></td><td>{money(r.amount)}</td><td>{r.transfer_reference}</td><td>{r.sender_name||"—"}</td><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.status}</td><td>
  {r.status==="Pending Verification"&&<button className="primary-btn" disabled={busyId===r.id} onClick={()=>setSelected(r)}>{busyId===r.id?"Processing...":"Review"}</button>}
  {r.proof_path&&<button className="secondary-btn" disabled={proofBusyId===r.id} onClick={async()=>{setProofBusyId(r.id);setError("");const {data:sessionData}=await supabase.auth.getSession();const accessToken=sessionData?.session?.access_token;if(!accessToken){setError("Your session has expired. Please sign in again.");setProofBusyId("");return;}const {data,error}=await supabase.functions.invoke("bank-transfer-proof-url",{body:{submissionId:r.id},headers:{Authorization:"Bearer "+accessToken}});if(error||data?.error){setError(error?.message||data?.error||"Unable to open proof.");setProofBusyId("");return;}window.open(data.url,"_blank","noopener,noreferrer");setProofBusyId("");}}>{proofBusyId===r.id?"Opening...":"View Proof"}</button>}
  {r.status!=="Pending Verification"&&!r.proof_path&&<span>{r.review_note||"—"}</span>}
</td></tr>})}
      </tbody></table></div>}
    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><h2>Verify Bank Transfer</h2><p><strong>Student:</strong> {[selected.students?.first_name,selected.students?.middle_name,selected.students?.last_name].filter(Boolean).join(" ")}</p><p><strong>Amount:</strong> {money(selected.amount)}</p><p><strong>Reference:</strong> {selected.transfer_reference}</p><p><strong>Sender:</strong> {selected.sender_name||"—"}</p><label style={{display:"grid",gap:6}}>Review note<textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} className="search-input" placeholder="Optional note"/></label><div style={{marginTop:16}}><button className="primary-btn" disabled={busyId===selected.id} onClick={()=>review(selected.id,"approve")}>Approve & Issue Receipt</button><button className="secondary-btn" disabled={busyId===selected.id} onClick={()=>review(selected.id,"reject")} style={{marginLeft:8}}>Reject</button></div><p style={{fontSize:12,color:"#64748b",marginTop:12}}>Approve only after confirming the transfer in the school's bank account.</p></div></div>}
  </div>;
}
