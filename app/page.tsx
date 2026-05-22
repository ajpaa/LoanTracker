"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/services/supabase"; 
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  PlusCircle, 
  ChevronRight,
  Inbox,
  TrendingUp,
  Sparkles
} from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  
  // State Management
  const [loading, setLoading] = useState(true);
  const [loansExist, setLoansExist] = useState(false);
  const [stats, setStats] = useState({
    totalLentOut: 0,
    totalRemainingToCollect: 0,
    totalOwed: 0,
    numberOfPeopleIOwe: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardMetrics() {
      try {
        setLoading(true);
        
        const { data: allEntries, error: fetchError } = await supabase
          .from('entries')
          .select('*');

        if (fetchError) throw fetchError;

        if (!allEntries || allEntries.length === 0) {
          setLoansExist(false);
          setLoading(false);
          return;
        }

        const currentUserId = allEntries[0]?.lender_id || "1"; 

        const lentEntries = allEntries.filter(e => e.lender_id === currentUserId && e.status !== 'paid');
        const borrowedEntries = allEntries.filter(e => e.borrower_id === currentUserId && e.status !== 'paid');

        const { data: recentLogs } = await supabase
          .from('entries')
          .select('*')
          .order('date_borrowed', { ascending: false })
          .limit(5);

        let lentSum = 0;
        let collectSum = 0;
        lentEntries.forEach(e => {
          lentSum += Number(e.amount_borrowed || 0);
          collectSum += Number(e.amount_remaining || 0);
        });

        let oweSum = 0;
        const uniqueCreditors = new Set();
        borrowedEntries.forEach(e => {
          oweSum += Number(e.amount_remaining || 0);
          if (e.lender_id) uniqueCreditors.add(e.lender_id);
        });

        setLoansExist(allEntries.length > 0);

        setStats({
          totalLentOut: lentSum,
          totalRemainingToCollect: collectSum,
          totalOwed: oweSum,
          numberOfPeopleIOwe: uniqueCreditors.size
        });

        if (recentLogs) {
          const formattedFeed = recentLogs.map(item => ({
            id: item.id, 
            name: item.entry_name,
            action: item.lender_id === currentUserId ? 'lent' : 'borrowed',
            amount: item.amount_borrowed,
            date: item.date_borrowed 
              ? new Date(item.date_borrowed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : "No date"
          }));
          setRecentActivity(formattedFeed);
        }

      } catch (err) {
        console.error("Supabase metrics sync exception:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardMetrics();
  }, []);

  return (
    <div className="min-vh-100 position-relative overflow-hidden px-4 px-md-5 py-5" style={{ backgroundColor: '#F8FAFC' }}>
      
      {/* Dynamic Fluid Glassmorphism Ambient Bubbles */}
      <div 
        className="position-absolute rounded-circle opacity-25"
        style={{ 
          width: '500px', 
          height: '500px', 
          background: 'linear-gradient(135deg, #C7D2FE 0%, #E9D5FF 100%)', 
          top: '-12%', 
          right: '-5%',
          filter: 'blur(100px)',
          animation: 'floatBubble1 14s infinite ease-in-out alternate',
          zIndex: 0
        }} 
      />
      <div 
        className="position-absolute rounded-circle opacity-20"
        style={{ 
          width: '400px', 
          height: '400px', 
          background: 'linear-gradient(135deg, #BAE6FD 0%, #C7D2FE 100%)', 
          bottom: '5%', 
          left: '15%',
          filter: 'blur(90px)',
          animation: 'floatBubble2 18s infinite ease-in-out alternate-reverse',
          zIndex: 0
        }} 
      />

      {/* Main Container Core */}
      <div className="position-relative" style={{ zIndex: 1 }}>
        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5 my-5" style={{ minHeight: '60vh' }}>
            <div className="spinner-border text-dark spinner-border-sm" role="status" />
          </div>
        ) : (
          <div className="row g-4 lg:g-5 align-items-start">
            
            {/* ==================== LEFT SIDE PANEL: MAIN HEADER & ACTIVITY ROWS ==================== */}
            <div className="col-12 col-xl-7">
              <div className="mb-5">
                <h1 className="fw-black tracking-tight text-dark m-0 d-flex align-items-center gap-2" style={{ fontSize: '2rem', letterSpacing: '-0.75px' }}>
                  Financial Overview <Sparkles size={22} className="text-warning opacity-75" />
                </h1>
                <p className="text-muted small m-0 mt-1" style={{ fontSize: '0.85rem' }}>
                  Real-time ledger audit balances and portfolio health indicators
                </p>
              </div>

              {!loansExist ? (
                <div className="card bg-white border-0 premium-card-shadow text-center p-5 d-flex flex-column align-items-center justify-content-center" style={{ borderRadius: '24px', minHeight: '400px' }}>
                  <div className="rounded-circle p-4 mb-4 d-flex align-items-center justify-content-center text-muted" style={{ width: '75px', height: '75px', backgroundColor: '#F1F5F9' }}>
                    <Inbox size={30} />
                  </div>
                  <h4 className="fw-bold text-dark mb-2" style={{ fontSize: "1rem" }}>No active transactions found</h4>
                  <p className="text-muted mx-auto mb-4" style={{ fontSize: "0.82rem", maxWidth: "320px", lineHeight: "1.5" }}>
                    Keep personal lending metrics, mutual shared bills, and due payments cleanly logged in your workspace.
                  </p>
                  <button 
                    onClick={() => router.push('/add_loans')}
                    className="btn btn-dark px-4 py-2.5 rounded-3 fw-bold shadow-sm"
                    style={{ fontSize: '0.82rem', backgroundColor: '#0F172A' }}
                  >
                    Add first loan
                  </button>
                </div>
              ) : (
                <div className="card bg-white border-0 premium-card-shadow p-4" style={{ borderRadius: '24px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <h6 className="fw-bold text-dark m-0" style={{ fontSize: '1.05rem', letterSpacing: '-0.3px' }}>Recent Activity Feed</h6>
                      <p className="text-muted small m-0" style={{ fontSize: '0.75rem' }}>Last 5 transaction alterations recorded</p>
                    </div>
                    <button 
                      onClick={() => router.push('/loans')}
                      className="btn btn-link text-decoration-none text-dark fw-bold p-0 small d-flex align-items-center gap-1 hover:text-primary transition-colors"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <span>View all</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {recentActivity.map((activity) => (
                      <div 
                        key={activity.id}
                        onClick={() => router.push(`/loans/${activity.id}`)}
                        className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-white activity-row-item"
                        style={{ cursor: 'pointer', backgroundColor: '#FAFBFD' }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <div className={`p-2 d-flex align-items-center justify-content-center ${
                            activity.action === 'lent' ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'
                          }`} style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
                            {activity.action === 'lent' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                          </div>
                          <div>
                            <p className="fw-bold text-dark m-0" style={{ fontSize: '0.88rem' }}>{activity.name}</p>
                            <p className="text-muted m-0" style={{ fontSize: '0.75rem', marginTop: '1px' }}>
                              Lent out capital portfolio context
                            </p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className={`fw-bold m-0 ${activity.action === 'lent' ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.92rem' }}>
                            {activity.action === 'lent' ? '+' : '-'} ₱{Number(activity.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-muted m-0 mt-1" style={{ fontSize: '0.7rem' }}>{activity.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ==================== RIGHT SIDE PANEL: METRICS BENTO GRID MODULES ==================== */}
            <div className="col-12 col-xl-5" style={{ marginTop: '4.8rem' }}>
              <div className="d-flex flex-column gap-4">
                
                {/* Accent Highlight Widget: TO COLLECT */}
                <div 
                  className="card text-white p-4 border-0 premium-card-shadow position-relative overflow-hidden" 
                  style={{ 
                    background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', 
                    borderRadius: '24px' 
                  }}
                >
                  <div className="position-absolute rounded-circle bg-white opacity-5" style={{ width: '130px', height: '130px', top: '-30px', right: '-30px' }} />
                  
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-white-50 text-uppercase tracking-wider fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.8px' }}>
                      TO COLLECT
                    </span>
                    <div className="rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      <TrendingUp size={16} className="text-white" />
                    </div>
                  </div>
                  <h2 className="fw-black tracking-tight text-white m-0 my-2" style={{ fontSize: '2.5rem', letterSpacing: '-1px' }}>
                    ₱{stats.totalRemainingToCollect.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </h2>
                  <div className="border-top mt-3 pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <p className="m-0 text-white-50" style={{ fontSize: '0.75rem' }}>Outstanding collections balance network payload metrics</p>
                  </div>
                </div>

                {/* Sub-Bento Multi-Metric Block */}
                <div className="card p-4 border-0 premium-card-shadow text-white" style={{ backgroundColor: '#111827', borderRadius: '24px' }}>
                  <div className="row g-4">
                    
                    {/* Total Lent Capital Row */}
                    <div className="col-12 pb-3 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <p className="text-uppercase tracking-wider fw-bold m-0" style={{ fontSize: '0.7rem', color: '#9CA3AF', letterSpacing: '0.5px' }}>TOTAL LENT CAPITAL</p>
                          <h3 className="text-white fw-bold tracking-tight m-0 mt-2" style={{ fontSize: '1.6rem', letterSpacing: '-0.5px' }}>
                            ₱{stats.totalLentOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </h3>
                        </div>
                        <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', backgroundColor: '#10B981', borderRadius: '8px' }}>
                          <ArrowUpRight size={16} className="text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Total I Owe */}
                    <div className="col-6 pt-2">
                      <p className="text-uppercase tracking-wider fw-bold m-0" style={{ fontSize: '0.68rem', color: '#9CA3AF', letterSpacing: '0.5px' }}>TOTAL I OWE</p>
                      <h4 className="text-white fw-bold tracking-tight m-0 mt-2" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                        ₱{stats.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </h4>
                    </div>

                    {/* Entities Count */}
                    <div className="col-6 pt-2 text-end border-start" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <p className="text-uppercase tracking-wider fw-bold m-0" style={{ fontSize: '0.68rem', color: '#9CA3AF', letterSpacing: '0.5px' }}>PEOPLE I OWE</p>
                      <h4 className="text-white fw-bold tracking-tight m-0 mt-2" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                        {stats.numberOfPeopleIOwe} <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>Entities</span>
                      </h4>
                    </div>

                  </div>
                </div>

                {/* Primary Animated Create Action CTA Button */}
                <button 
                  onClick={() => router.push('/add_loans')}
                  className="btn btn-dark w-100 py-3.5 rounded-4 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 border-0 mt-1 premium-card-shadow"
                  style={{ 
                    backgroundColor: '#0F172A', 
                    fontSize: '0.9rem', 
                    borderRadius: '16px'
                  }}
                >
                  <PlusCircle size={18} />
                  <span>Create New Entry Protocol</span>
                </button>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}