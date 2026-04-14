import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, setSession } from '../lib/api'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await callApi('admin_login', { email, passcode })
      setSession({ token: data.token, email, name: data.name, role: 'admin', is_superadmin: data.is_superadmin })
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#073991'}}>
      <div style={{background:'#0d2a6e',padding:'40px',borderRadius:'16px',width:'360px',border:'1px solid rgba(255,255,255,0.1)'}}>
        <h2 style={{fontFamily:'Playfair Display, serif',color:'#fff',marginBottom:'8px',fontSize:'24px'}}>Admin Login</h2>
        <p style={{color:'#8bacc8',fontSize:'13px',marginBottom:'24px'}}>VFO Portal</p>
        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" required style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:'14px'}} />
          <input value={passcode} onChange={e=>setPasscode(e.target.value)} placeholder="Passcode" type="password" required style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:'14px'}} />
          {error && <p style={{color:'#ff6b6b',fontSize:'13px',margin:'0'}}>{error}</p>}
          <button type="submit" disabled={loading} style={{padding:'11px',borderRadius:'8px',background:'#2563eb',border:'none',color:'#fff',fontSize:'15px',fontWeight:'500',cursor:'pointer',marginTop:'4px'}}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        <p style={{color:'#8bacc8',fontSize:'13px',marginTop:'16px',textAlign:'center',cursor:'pointer'}} onClick={()=>navigate('/')}>← Back</p>
      </div>
    </div>
  )
}