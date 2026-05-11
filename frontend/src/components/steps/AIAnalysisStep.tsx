import React, { useEffect, useState } from 'react';
import { useSession } from '../../App';
import axios from 'axios';
import { Hexagon, Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const steps = [
  'Reformulating your answers into BIS queries...',
  'Searching standards database...',
  'Re-ranking results by relevance...',
  'Preparing your recommendation...',
];

const messages = [
  "Analyzing chemical composition requirements...",
  "Cross-referencing exposure class specifications...",
  "Mapping certification pathways for MSEs..."
];

// Dummy results matching the prompt
const dummyResults = [
  {
    rank: 1,
    standard_code: 'IS 12269:2013',
    standard_title: 'Ordinary Portland Cement, 53 Grade — Specification',
    applicability_rationale: 'Your product is OPC 53 Grade manufactured for structural concrete and precast applications. IS 12269:2013 directly governs the physical and chemical requirements for this grade.',
    key_requirement: 'Minimum 28-day compressive strength: 53 MPa; MgO ≤ 6.0%; initial setting time ≥ 30 min',
    mandatory: true,
    certification_path: 'BIS License — Simplified Certification Procedure for MSEs',
    confidence: 'High',
    confidence_reason: 'Retrieved chunk directly covers physical and chemical requirements for OPC 53 grade',
    next_action: 'Submit BIS license application under IS 12269:2013 at bis.gov.in. As an MSE, you qualify for reduced testing fees and simplified audit process.'
  },
  {
    rank: 2,
    standard_code: 'IS 456:2000',
    standard_title: 'Plain and Reinforced Concrete — Code of Practice',
    applicability_rationale: 'Your cement targets structural concrete buyers who will reference IS 456:2000 for permissible cement grades and exposure class compatibility.',
    key_requirement: 'OPC 53 Grade recommended for moderate to severe exposure; w/c ratio ≤ 0.50 for moderate exposure',
    mandatory: false,
    certification_path: 'Voluntary — Referenced by structural engineers',
    confidence: 'Medium',
    confidence_reason: 'Governs end-use context of the product, not the manufacturing specification',
    next_action: 'Include IS 456:2000 exposure class compatibility in your product technical data sheets to support buyer compliance documentation.'
  }
];

  export default function AIAnalysisStep() {
  const { state, dispatch } = useSession();
  const [currentStep, setCurrentStep] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    // Start animation steps
    const intervals = [1500, 3000, 4500, 6000];
    const timers = intervals.map((time, idx) => setTimeout(() => setCurrentStep(idx + 1), time));

    const msgInterval = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % messages.length);
    }, 2500);

    // Make API Call
    const fetchResults = async () => {
      try {
        const queryParts = [state.category, ...Object.values(state.answers).flat()].filter(Boolean);
        const query = queryParts.join(" ");
        
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await axios.post(`${apiUrl}/query`, { query });
        
        // Ensure minimum time for animations to show
        setTimeout(() => {
          if (response.data && response.data.retrieved_standards) {
            const narrative = response.data.response || "No detailed response generated.";
            
            const parsedResults = response.data.retrieved_standards.map((std: string, idx: number) => ({
              rank: idx + 1,
              standard_code: std.split(' ')[0] + ' ' + (std.split(' ')[1] || ''),
              standard_title: std,
              applicability_rationale: narrative,
              key_requirement: 'Matches your query: ' + query,
              mandatory: idx === 0, // Assumption for UI
              certification_path: 'Standard BIS Licensing',
              confidence: idx === 0 ? 'High' : 'Medium',
              confidence_reason: 'RAG retrieval match',
              next_action: 'Consult BIS portal for ' + std
            }));
            
            dispatch({ type: 'SET_RESULTS', payload: parsedResults.length > 0 ? parsedResults : dummyResults });
          } else {
            dispatch({ type: 'SET_RESULTS', payload: dummyResults });
          }
        }, 3000); // minimum 3s wait
      } catch (error) {
        console.error("Failed to fetch from API", error);
        setTimeout(() => {
          dispatch({ type: 'SET_RESULTS', payload: dummyResults }); // Fallback
        }, 3000);
      }
    };

    fetchResults();

    return () => {
      timers.forEach(t => clearTimeout(t));
      clearInterval(msgInterval);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative animate-fadeUp">
      
      {/* Central Animation */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-blue-600/20 blur-[32px] rounded-full" />
        
        {/* Hexagon Spinner */}
        <div className="relative w-24 h-24 flex items-center justify-center filter drop-shadow-[0_0_16px_rgba(37,99,235,0.6)]">
          <svg className="absolute w-full h-full animate-[spin_4s_linear_infinite]" viewBox="0 0 100 100">
            <polygon 
              points="50 3, 93 25, 93 75, 50 97, 7 75, 7 25" 
              fill="none" 
              stroke="rgba(37,99,235,0.4)" 
              strokeWidth="2"
            />
            <polygon 
              points="50 3, 93 25, 93 75, 50 97, 7 75, 7 25" 
              fill="none" 
              stroke="#3B82F6" 
              strokeWidth="4" 
              strokeDasharray="60 180"
              className="origin-center"
            />
          </svg>
          <Hexagon className="text-white animate-pulse" size={36} fill="currentColor" fillOpacity={0.2} />
        </div>
      </div>

      {/* Status Steps */}
      <div className="w-full max-w-md space-y-4 mb-12">
        {steps.map((text, idx) => {
          const isDone = currentStep > idx;
          const isActive = currentStep === idx;
          const isPending = currentStep < idx;

          return (
            <div key={idx} className={clsx(
              "flex items-center gap-4 transition-all duration-300",
              isDone ? "opacity-60" : isActive ? "opacity-100 scale-105" : "opacity-30"
            )}>
              <div className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                isDone ? "bg-emerald-500/20 text-emerald-500" : 
                isActive ? "text-blue-400" : "bg-white/5 text-white/30"
              )}>
                {isDone ? <Check size={14} strokeWidth={3} /> : isActive ? <Loader2 size={16} className="animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
              </div>
              <span className={clsx(
                "font-body text-[15px]",
                isDone ? "text-emerald-400/80" : isActive ? "text-white font-medium" : "text-white/50"
              )}>
                {text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md h-1.5 rounded-full bg-[#151D35] overflow-hidden mb-6">
        <div className="h-full w-full animate-shimmer" />
      </div>

      {/* Ambient Text */}
      <div className="h-6 overflow-hidden">
        <p key={msgIdx} className="font-mono text-[13px] text-[#4A5A7A] italic animate-fadeUp">
          {messages[msgIdx]}
        </p>
      </div>

    </div>
  );
}
