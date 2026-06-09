import { useNavigate } from 'react-router-dom'

export default function RolePicker() {
  const navigate = useNavigate()
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'16px',background:'#073991'}}>
      <h1 style={{fontFamily:'Playfair Display, serif',fontSize:'32px',color:'#ffffff',margin:'0'}}>VFO Portal</h1>
      <p style={{fontSize:'13px',color:'#8bacc8',margin:'0 0 16px'}}>Select your portal</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',justifyContent:'center'}}>
        <button onClick={() => navigate('/admin/login')} style={{padding:'12px 36px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#ffffff',fontSize:'15px',fontWeight:'500',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>VFOS/ERT</button>
        <button onClick={() => {}} style={{padding:'12px 36px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#ffffff',fontSize:'15px',fontWeight:'500',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Specialist</button>
        <button onClick={() => navigate('/member/login')} style={{padding:'12px 36px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#ffffff',fontSize:'15px',fontWeight:'500',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Member</button>
        <button onClick={() => navigate('/client/login')} style={{padding:'12px 36px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#ffffff',fontSize:'15px',fontWeight:'500',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Client</button>
      </div>
    </div>
  )
}