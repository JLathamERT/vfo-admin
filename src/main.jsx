import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const redirect = sessionStorage.getItem('vfo_redirect')
if (redirect) {
  sessionStorage.removeItem('vfo_redirect')
  window.history.replaceState(null, '', '/vfo-portal/' + redirect)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/vfo-portal">
    <App />
  </BrowserRouter>
)