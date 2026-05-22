"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/services/supabase"; 
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  Users, 
  PlusCircle, 
  ChevronRight,
  Activity,
  Inbox
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
        
        // 1. Fetch ALL entries first to accurately check system health and find a valid ID string
        const { data: allEntries, error: fetchError } = await supabase
          .from('entries')
          .select('*');

        if (fetchError) throw fetchError;

        if (!allEntries || allEntries.length === 0) {
          setLoansExist(false);
          setLoading(false);
          return;
        }

        // 2. Identify Current User ID Context
        // Dynamic Fallback: Uses the first record's lender_id as a mock session context so your UI populated immediately!
        // Swap this with your true Supabase Auth user.id string later.
        const currentUserId = allEntries[0]?.lender_id || "1"; 

        // 3. Filter client-side using exact database lowercase enum strings ('paid' / 'unpaid')
        const lentEntries = allEntries.filter(e => e.lender_id === currentUserId && e.status !== 'paid');
        const borrowedEntries = allEntries.filter(e => e.borrower_id === currentUserId && e.status !== 'paid');

        // Fetch the 5 most recent entries safely sorted by date
        const { data: recentLogs } = await supabase
          .from('entries')
          .select('*')
          .order('date_borrowed', { ascending: false })
          .limit(5);

        // --- Ledger Metrics Calculation Engine ---
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

        // Toggle state: If there are ANY entries in the system, show the dashboard metrics layout
        setLoansExist(allEntries.length > 0);

        setStats({
          totalLentOut: lentSum,
          totalRemainingToCollect: collectSum,
          totalOwed: oweSum,
          numberOfPeopleIOwe: uniqueCreditors.size
        });

        // Map recent database rows into activity feed display rows
        if (recentLogs) {
          const formattedFeed = recentLogs.map(item => ({
            id: item.id, // FIXED: Changed from item.entry_id to exact schema primary key 'id'
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
    <div className="container py-5" style={{ maxWidth: "1200px" }}>
      
      {/* Dynamic Header Action Bar */}
      <div className="d-flex justify-content-between align-items-center mb-5 pb-3 border-bottom">
        <div>
          <h1 className="fw-black tracking-tight text-dark m-0" style={{ fontSize: "2rem", letterSpacing: "-0.5px" }}>
            Financial Overview
          </h1>
          <p className="text-muted small m-0 mt-1">Real-time ledger audit balances and portfolio health indicators</p>
        </div>
        
        <button 
          onClick={() => router.push('/add_loans')} 
          className="btn btn-dark px-4 py-2 rounded-3 shadow-sm d-inline-flex align-items-center gap-2 fw-semibold border-0"
          style={{ transition: "all 0.2s ease", backgroundColor: "#0f172a" }}
        >
          <PlusCircle size={15} />
          <span style={{ fontSize: "0.85rem" }}>Add Loan</span>
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : !loansExist ? (
        
        /* EMPTY STATE RENDER BLOCK */
        <div className="space-y-5">
          <div className="row g-4 mb-5">
            {[
              { title: "Total Lent", val: "₱0.00", icon: <ArrowUpRight size={16} className="text-muted" /> },
              { title: "To Collect", val: "₱0.00", icon: <DollarSign size={16} className="text-muted" /> },
              { title: "I Still Owe", val: "₱0.00", icon: <ArrowDownLeft size={16} className="text-muted" /> },
              { title: "People I Owe", val: "0", icon: <Users size={16} className="text-muted" /> }
            ].map((c, i) => (
              <div key={i} className="col-12 col-md-6 col-lg-3">
                <div className="card p-4 border-1 rounded-4 shadow-sm h-100 bg-white">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="text-muted font-bold text-uppercase tracking-wider small" style={{ fontSize: "0.7rem", fontWeight: 700 }}>{c.title}</span>
                    <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: "#f1f5f9" }}>{c.icon}</div>
                  </div>
                  <h3 className="fw-black text-muted tracking-tight m-0" style={{ fontSize: "1.65rem", opacity: 0.4 }}>{c.val}</h3>
                  <p className="text-muted small m-0 mt-2" style={{ fontSize: "0.7rem" }}>No active records logged</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card text-center p-5 border-1 rounded-4 shadow-sm mx-auto bg-white" style={{ maxWidth: "500px" }}>
            <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4 border" 
                 style={{ width: "50px", height: "50px", backgroundColor: "#eff6ff", borderColor: "#dbeafe" }}>
              <Inbox size={20} className="text-primary" />
            </div>
            <h4 className="fw-bold text-dark mb-2" style={{ fontSize: "1.05rem" }}>No active transactions</h4>
            <p className="text-muted mx-auto mb-4" style={{ fontSize: "0.8rem", maxWidth: "340px", lineHeight: "1.5" }}>
              Keep personal lending metrics, mutual shared bills, and due payments cleanly logged in your system layout workspace.
            </p>
            <button 
              onClick={() => router.push('/add_loans')}
              className="btn btn-primary px-4 py-2.5 rounded-3 fw-bold mx-auto border-0 d-inline-flex align-items-center gap-2"
              style={{ fontSize: "0.8rem", backgroundColor: "#2563eb", boxShadow: "0 4px 12px rgba(37,99,235,0.15)" }}
            >
              <PlusCircle size={15} />
              <span>Add first loan</span>
            </button>
          </div>
        </div>

      ) : (

        /* LIVE ACTIVE DATA PRESENTATION PANEL */
        <>
          <div className="row g-4 mb-5">
            
            {/* Card 1: Total Lent Out */}
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card p-4 border-1 rounded-4 shadow-sm bg-white h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted text-uppercase tracking-wider" style={{ fontSize: "0.7rem", fontWeight: 700 }}>Total Lent</span>
                  <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: "#ecfdf5" }}>
                    <ArrowUpRight size={16} className="text-success" />
                  </div>
                </div>
                <h3 className="fw-black text-dark tracking-tight m-0" style={{ fontSize: "1.65rem" }}>
                  ₱{stats.totalLentOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-muted small m-0 mt-2" style={{ fontSize: "0.7rem" }}>Principal capital assets deployed</p>
              </div>
            </div>

            {/* Card 2: To Collect */}
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card p-4 border-1 rounded-4 shadow-sm bg-white h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted text-uppercase tracking-wider" style={{ fontSize: "0.7rem", fontWeight: 700 }}>To Collect</span>
                  <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: "#eff6ff" }}>
                    <DollarSign size={16} className="text-primary" />
                  </div>
                </div>
                <h3 className="fw-black text-dark tracking-tight m-0" style={{ fontSize: "1.65rem" }}>
                  ₱{stats.totalRemainingToCollect.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-primary small m-0 mt-2 fw-semibold" style={{ fontSize: "0.7rem" }}>Outstanding collections payload</p>
              </div>
            </div>

            {/* Card 3: Total Owed */}
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card p-4 border-1 rounded-4 shadow-sm bg-white h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted text-uppercase tracking-wider" style={{ fontSize: "0.7rem", fontWeight: 700 }}>Total I Owe</span>
                  <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: "#fff1f2" }}>
                    <ArrowDownLeft size={16} className="text-danger" />
                  </div>
                </div>
                <h3 className="fw-black text-dark tracking-tight m-0" style={{ fontSize: "1.65rem" }}>
                  ₱{stats.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-muted small m-0 mt-2" style={{ fontSize: "0.7rem" }}>Unsettled accounts liability</p>
              </div>
            </div>

            {/* Card 4: Creditor Count */}
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card p-4 border-1 rounded-4 shadow-sm bg-white h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted text-uppercase tracking-wider" style={{ fontSize: "0.7rem", fontWeight: 700 }}>People I Owe</span>
                  <div className="rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: "#fef3c7" }}>
                    <Users size={16} className="text-warning" />
                  </div>
                </div>
                <h3 className="fw-black text-dark tracking-tight m-0" style={{ fontSize: "1.65rem" }}>
                  {stats.numberOfPeopleIOwe}
                </h3>
                <p className="text-warning small m-0 mt-2 fw-semibold" style={{ fontSize: "0.7rem" }}>Active counter-party entities</p>
              </div>
            </div>

          </div>

          {/* RECENT ACTIVITY FEED BLOCK */}
          <div className="card border-1 rounded-4 shadow-sm overflow-hidden bg-white">
            <div className="px-4 py-4 border-bottom border-light d-flex justify-content-between align-items-center bg-light" style={{ opacity: 0.95 }}>
              <div className="d-flex align-items-center gap-2">
                <Activity size={16} className="text-muted" />
                <div>
                  <h3 className="fw-bold text-dark m-0" style={{ fontSize: "0.9rem" }}>Recent Activity Feed</h3>
                  <p className="text-muted small m-0" style={{ fontSize: "0.7rem", marginTop: "2px" }}>Last 5 transaction alterations recorded across operations</p>
                </div>
              </div>
              <button 
                onClick={() => router.push('/loans')} 
                className="btn btn-link text-primary p-0 text-decoration-none fw-bold d-inline-flex align-items-center gap-1"
                style={{ fontSize: "0.8rem" }}
              >
                <span>View all</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="list-group list-group-flush">
              {recentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  onClick={() => router.push(`/loans/${activity.id}`)}
                  className="list-group-item px-4 py-3 d-flex justify-content-between align-items-center list-group-item-action border-0 border-bottom"
                  style={{ cursor: "pointer", transition: "background-color 0.15s ease" }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className={`rounded-3 p-2 d-flex align-items-center justify-content-center ${
                      activity.action === 'lent' ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'
                    }`}>
                      {activity.action === 'lent' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </div>
                    <div>
                      <p className="fw-bold text-dark m-0" style={{ fontSize: "0.85rem" }}>{activity.name}</p>
                      <p className="text-muted small m-0" style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                        Account context recorded as {activity.action === 'lent' ? 'lent out capital portfolio' : 'borrowed liability debt'}
                      </p>
                    </div>
                  </div>

                  <div className="text-end">
                    <p className={`fw-bold m-0 ${activity.action === 'lent' ? 'text-success' : 'text-danger'}`} style={{ fontSize: "0.85rem" }}>
                      {activity.action === 'lent' ? '+' : '-'} ₱{Number(activity.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-muted small m-0 mt-1" style={{ fontSize: "0.7rem" }}>{activity.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
}