"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/services/supabase"; 
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  PlusCircle, 
  ChevronRight,
  Inbox,
  TrendingUp,
  Sparkles,
  DollarSign
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

        // 1. FETCH FROM YOUR EXISTING VIEW: v_dashboard_summary
        // Since you have a single-user system, we calculate metrics accurately from the raw table
        const { data: allEntries, error: entriesError } = await supabase
          .from('entries')
          .select('*');

        if (entriesError) throw entriesError;

        // 2. FETCH FROM YOUR EXISTING VIEW: v_recent_activity
        const { data: rawActivity, error: activityError } = await supabase
          .from('v_recent_activity')
          .select('*')
          .limit(5);

        if (activityError) throw activityError;

        if (!allEntries || allEntries.length === 0) {
          setLoansExist(false);
          setLoading(false);
          return;
        }

        setLoansExist(true);

        // Define your ID in the system (Assuming "1" or your primary user profile identifier)
        const currentUserId = allEntries[0]?.lender_id || "1"; 

        // Split active entries logically to prevent the Cartesian view glitch
        const lentEntries = allEntries.filter(e => e.lender_id === currentUserId && e.status !== 'paid');
        const borrowedEntries = allEntries.filter(e => e.borrower_id === currentUserId && e.status !== 'paid');

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

        setStats({
          totalLentOut: lentSum,
          totalRemainingToCollect: collectSum,
          totalOwed: oweSum,
          numberOfPeopleIOwe: uniqueCreditors.size
        });

        // 3. MAP THE RECENT ACTIVITY DATA FROM YOUR SQL VIEW
        if (rawActivity) {
          const formattedFeed = rawActivity.map(item => {
            // Determine direction relative to you
            const isLender = item.lender_name === "ME" || item.activity_type === 'payment';
            
            return {
              id: item.id,
              name: item.label || "Untitled Transaction",
              // Distinguish payment logs visually from new loans
              action: item.activity_type === 'payment' ? 'payment' : (isLender ? 'lent' : 'borrowed'),
              amount: item.amount,
              subtitle: item.activity_type === 'payment' 
                ? `Repayment by ${item.borrower_name || 'Borrower'}`
                : `To: ${item.borrower_name || 'Someone'}`,
              date: item.activity_date 
                ? new Date(item.activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : "No date"
            };
          });
          setRecentActivity(formattedFeed);
        }

      } catch (err) {
        console.error("Dashboard metric resolution mapping error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardMetrics();
  }, []);

  return (
    <div 
      className="min-vh-100 position-relative overflow-hidden px-4 px-md-5 py-5" 
      style={{ 
        backgroundColor: '#F8FAFC',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg opacity='0.035'%3E%3Cpath fill='%2315803d' d='M25,15 L55,22 C56,22.2 56.8,21.5 56.5,20.5 L50,5 C49.8,4 48.5,3.5 47.5,4 L22,11 C21,11.2 20.5,12.5 21,13.5 L23.5,14.5 Z' /%3E%3Ccircle fill='%2316a34a' cx='37.5' cy='13.5' r='4' /%3E%3Cpath fill='%2315803d' d='M85,45 L110,35 C111,34.6 111.2,33.2 110.5,32.5 L98,20 C97.2,19.2 95.8,19.5 95.5,20.5 L90,40 C89.8,41 90.5,41.8 91.5,41.5 Z' /%3E%3Ccircle fill='%2316a34a' cx='99' cy='31' r='3.5' /%3E%3Cpath fill='%2315803d' d='M35,85 L65,75 C66,74.6 66.2,73.2 65.5,72.5 L53,60 C52.2,59.2 50.8,59.5 50.5,60.5 L45,80 C44.8,81 45.5,81.8 46.5,81.5 Z' /%3E%3Ccircle fill='%2316a34a' cx='54.5' cy='71' r='3.5' /%3E%3Cpath fill='%2315803d' d='M80,95 L110,102 C111,102.2 111.8,101.5 111.5,100.5 L105,85 C104.8,84 103.5,83.5 102.5,84 L77,91 C76,91.2 75.5,92.5 76,93.5 L78.5,94.5 Z' /%3E%3Ccircle fill='%2316a34a' cx='92.5' cy='93.5' r='4' /%3E%3C/g%3E%3C/svg%3E")`
      }}
    >
      
      {/* Soft Ambient Light Glow Layers */}
      <div 
        className="position-absolute rounded-circle opacity-25"
        style={{ 
          width: '500px', 
          height: '500px', 
          background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)', 
          top: '-10%', 
          right: '-5%',
          filter: 'blur(80px)',
          zIndex: 0,
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
            
            {/* ==================== LEFT SIDE WINDOW PANEL ==================== */}
            <div className="col-12 col-xl-7">
              <div className="mb-5">
                <h1 className="tracking-tight text-dark m-0 d-flex align-items-center gap-2" style={{ fontSize: '2.1rem', letterSpacing: '-0.75px', fontWeight: '700' }}>
                  Loan Dashboard <Sparkles size={20} className="text-warning opacity-75" />
                </h1>
                <p className="text-muted small m-0 mt-1" style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                  Monitor loans, repayments, and borrower activity in real time
                </p>
              </div>

              {!loansExist ? (
                <div 
                  className="card text-center p-5 d-flex flex-column align-items-center justify-content-center shadow-lg border-0" 
                  style={{ 
                    borderRadius: '24px', 
                    minHeight: '410px',
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.6)'
                  }}
                >
                  <div className="rounded-circle p-4 mb-4 d-flex align-items-center justify-content-center text-muted" style={{ width: '75px', height: '75px', backgroundColor: 'rgba(15, 23, 42, 0.05)' }}>
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
                <div 
                  className="card p-4 shadow-lg border-0" 
                  style={{ 
                    borderRadius: '24px',
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.7)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.02), 0 10px 10px -5px rgba(0, 0, 0, 0.01)'
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <h6 className="fw-bold text-dark m-0" style={{ fontSize: '1.05rem', letterSpacing: '-0.3px' }}>Recent Transactions</h6>
                      <p className="text-muted small m-0" style={{ fontSize: '0.78rem' }}>Latest five activities </p>
                    </div>
                    <button 
                      onClick={() => router.push('/loans')}
                      className="btn btn-link text-decoration-none text-dark fw-bold p-0 small d-flex align-items-center gap-1 hover-scale transition-all"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <span>View all</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="d-flex flex-column gap-2.5">
                    {recentActivity.map((activity, idx) => (
                      <div 
                        key={activity.id || idx}
                        onClick={() => router.push(`/loans/${activity.id}`)}
                        className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-white hover-activity-row transition-all duration-200"
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          border: '1px solid rgba(241, 245, 249, 0.9)'
                        }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <div className={`p-2 d-flex align-items-center justify-content-center ${
                            activity.action === 'lent' ? 'bg-success bg-opacity-10 text-success' : 
                            activity.action === 'payment' ? 'bg-info bg-opacity-10 text-info' : 'bg-danger bg-opacity-10 text-danger'
                          }`} style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
                            {activity.action === 'lent' && <ArrowUpRight size={18} />}
                            {activity.action === 'borrowed' && <ArrowDownLeft size={18} />}
                            {activity.action === 'payment' && <DollarSign size={18} />}
                          </div>
                          <div>
                            <p className="fw-bold text-dark m-0" style={{ fontSize: '0.9rem', letterSpacing: '-0.1px' }}>{activity.name}</p>
                            <p className="text-muted m-0" style={{ fontSize: '0.75rem', marginTop: '1px', fontWeight: 500 }}>
                              {activity.subtitle}
                            </p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className={`fw-bold m-0 ${activity.action === 'lent' ? 'text-success' : activity.action === 'payment' ? 'text-info' : 'text-danger'}`} style={{ fontSize: '0.95rem' }}>
                            {activity.action === 'lent' ? '+' : activity.action === 'payment' ? '✓' : '-'} ₱{Number(activity.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-muted m-0 mt-1" style={{ fontSize: '0.72rem', fontWeight: 500 }}>{activity.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ==================== RIGHT SIDE PANEL: METRICS GRID ==================== */}
            <div className="col-12 col-xl-5" style={{ marginTop: '4.8rem' }}>
              <div className="d-flex flex-column gap-4 floating-container">
                
                {/* Accent Highlight Card: PENDING COLLECTIONS */}
                <div 
                  className="card text-white p-4 border-0 shadow-xl" 
                  style={{ 
                    background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', 
                    borderRadius: '24px',
                    boxShadow: '0 25px 30px -5px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  <div className="position-absolute rounded-circle bg-white opacity-5" style={{ width: '130px', height: '130px', top: '-30px', right: '-30px' }} />
                  
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-white-50 text-uppercase tracking-wider fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.8px' }}>
                      PENDING COLLECTIONS
                    </span>
                    <div className="rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      <TrendingUp size={16} className="text-white" />
                    </div>
                  </div>
                  <h2 className="fw-black tracking-tight text-white m-0 my-2" style={{ fontSize: '2.5rem', letterSpacing: '-1px' }}>
                    ₱{stats.totalRemainingToCollect.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </h2>
                  <div className="border-top mt-3 pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <p className="m-0 text-white-50" style={{ fontSize: '0.75rem', fontWeight: 400 }}>Total unpaid loan balances awaiting repayment</p>
                  </div>
                </div>

                {/* Sub-Bento Multi-Metric Deck */}
                <div 
                  className="card p-4 border-0 shadow-xl text-white" 
                  style={{ 
                    backgroundColor: 'rgba(17, 24, 39, 0.92)', 
                    borderRadius: '24px',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.04)'
                  }}
                >
                  <div className="row g-4">
                    
                    {/* Total Amount Lent Row */}
                    <div className="col-12 pb-3 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <p className="text-uppercase tracking-wider fw-bold m-0" style={{ fontSize: '0.7rem', color: '#9CA3AF', letterSpacing: '0.5px' }}>TOTAL AMOUNT LENT</p>
                          <h3 className="text-white fw-bold tracking-tight m-0 mt-2" style={{ fontSize: '1.6rem', letterSpacing: '-0.5px' }}>
                            ₱{stats.totalLentOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </h3>
                        </div>
                        <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', backgroundColor: '#10B981', borderRadius: '8px' }}>
                          <ArrowUpRight size={16} className="text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Total Borrowed */}
                    <div className="col-6 pt-2">
                      <p className="text-uppercase tracking-wider fw-bold m-0" style={{ fontSize: '0.68rem', color: '#9CA3AF', letterSpacing: '0.5px' }}>TOTAL BORROWED</p>
                      <h4 className="text-white fw-bold tracking-tight m-0 mt-2" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                        ₱{stats.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </h4>
                    </div>

                    {/* Active Borrowers */}
                    <div className="col-6 pt-2 text-end border-start" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <p className="text-uppercase tracking-wider fw-bold m-0" style={{ fontSize: '0.68rem', color: '#9CA3AF', letterSpacing: '0.5px' }}>ACTIVE CREDITORS</p>
                      <h4 className="text-white fw-bold tracking-tight m-0 mt-2" style={{ fontSize: '1.25rem', letterSpacing: '-0.3px' }}>
                        {stats.numberOfPeopleIOwe} <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>{stats.numberOfPeopleIOwe === 1 ? 'Person' : 'People'}</span>
                      </h4>
                    </div>

                  </div>
                </div>

                {/* Primary Action CTA Button */}
                <button 
                  onClick={() => router.push('/add_loans')}
                  className="btn btn-dark w-100 py-3.5 rounded-4 fw-bold d-flex align-items-center justify-content-center gap-2 border-0 mt-1 shadow-lg action-cta-button"
                  style={{ 
                    backgroundColor: '#0F172A', 
                    fontSize: '0.9rem', 
                    borderRadius: '16px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <PlusCircle size={18} />
                  <span>Add New Loan</span>
                </button>

              </div>
            </div>

          </div>
        )}
      </div>

      {/* Global CSS Micro-Interactions */}
      <style jsx global>{`
        .hover-activity-row {
          transition: all 0.2s ease-in-out !important;
        }
        .hover-activity-row:hover {
          transform: translateY(-2px);
          background-color: #ffffff !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04) !important;
          border-color: rgba(203, 213, 225, 0.6) !important;
        }

        .hover-scale:hover {
          transform: scale(1.03);
          color: #2563eb !important;
        }

        .action-cta-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.25) !important;
          background-color: #1e293b !important;
        }
        
        .action-cta-button:active {
          transform: translateY(-1px);
        }

        .floating-container {
          animation: gentleFloat 6s infinite ease-in-out alternate;
        }

        @keyframes gentleFloat {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}