import React, { useState } from 'react';
import { Shield, Server, Zap, AlertTriangle, Search, FileText, GitBranch, CheckCircle } from 'lucide-react';

const SecurityMCPArchitecture = () => {
  const [selectedFlow, setSelectedFlow] = useState('incident');

  const flows = {
    incident: {
      title: "Security Incident Flow",
      steps: [
        { actor: "Now Assist", action: "Detects security incident in ServiceNow", icon: AlertTriangle },
        { actor: "MCP Server", action: "Calls local AI for threat analysis", icon: Server },
        { actor: "Local AI", action: "Analyzes patterns, CVEs, threat intel", icon: Zap },
        { actor: "MCP Server", action: "Returns enriched context", icon: Server },
        { actor: "Now Assist", action: "Updates incident with recommendations", icon: CheckCircle }
      ]
    },
    vulnerability: {
      title: "Vulnerability Assessment Flow",
      steps: [
        { actor: "Local AI", action: "Scans code/systems for vulnerabilities", icon: Search },
        { actor: "MCP Server", action: "Creates ServiceNow vulnerability records", icon: Server },
        { actor: "Now Assist", action: "Prioritizes based on business impact", icon: AlertTriangle },
        { actor: "MCP Server", action: "Requests remediation guidance", icon: Server },
        { actor: "Local AI", action: "Provides fix recommendations", icon: FileText }
      ]
    },
    collaborative: {
      title: "Collaborative Investigation",
      steps: [
        { actor: "Now Assist", action: "Identifies suspicious activity pattern", icon: AlertTriangle },
        { actor: "MCP Server", action: "Queries local AI for similar incidents", icon: Server },
        { actor: "Local AI", action: "Correlates with threat intelligence", icon: Search },
        { actor: "MCP Server", action: "Syncs findings to ServiceNow", icon: GitBranch },
        { actor: "Both", action: "Co-author incident response plan", icon: CheckCircle }
      ]
    },
    phishing: {
      title: "Phishing Detection & Response",
      steps: [
        { actor: "Now Assist", action: "Receives phishing report from user", icon: AlertTriangle },
        { actor: "MCP Server", action: "Sends email/URL to local AI for analysis", icon: Server },
        { actor: "Local AI", action: "Analyzes indicators, checks threat databases", icon: Search },
        { actor: "MCP Server", action: "Updates ServiceNow with verdict", icon: Server },
        { actor: "Now Assist", action: "Auto-blocks threats, notifies affected users", icon: CheckCircle }
      ]
    },
    remediation: {
      title: "Automated Remediation",
      steps: [
        { actor: "Now Assist", action: "Detects critical vulnerability", icon: AlertTriangle },
        { actor: "MCP Server", action: "Requests remediation script from local AI", icon: Server },
        { actor: "Local AI", action: "Generates safe remediation code", icon: FileText },
        { actor: "MCP Server", action: "Validates and deploys to test environment", icon: Server },
        { actor: "Now Assist", action: "Executes patch after approval", icon: CheckCircle }
      ]
    },
    compliance: {
      title: "Security Compliance Monitoring",
      steps: [
        { actor: "Now Assist", action: "Runs scheduled compliance scan", icon: Search },
        { actor: "MCP Server", action: "Sends results to local AI for analysis", icon: Server },
        { actor: "Local AI", action: "Identifies gaps and provides recommendations", icon: Zap },
        { actor: "MCP Server", action: "Creates compliance tickets in ServiceNow", icon: Server },
        { actor: "Now Assist", action: "Assigns remediation tasks to teams", icon: CheckCircle }
      ]
    }
  };

  const tools = [
    { name: "analyze_threat", desc: "AI analyzes threat indicators, CVEs, IOCs" },
    { name: "enrich_incident", desc: "Add context from threat intel databases" },
    { name: "correlate_vulnerabilities", desc: "Link vulns across systems" },
    { name: "generate_remediation", desc: "AI creates step-by-step fixes" },
    { name: "assess_risk", desc: "Calculate business impact scores" },
    { name: "create_playbook", desc: "Auto-generate response procedures" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8" style={{background: 'linear-gradient(to bottom right, #032D42, #054A6F, #032D42)'}}>
      <div className="max-w-6xl mx-auto">
        {/* ServiceNow Logo */}
        <div className="flex justify-center mb-8">
          <svg width="300" height="60" viewBox="0 0 300 60" className="drop-shadow-lg">
            <defs>
              <style>
                {`
                  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@700;900&display=swap');
                  .logo-text { font-family: 'Source Sans Pro', sans-serif; font-weight: 900; }
                `}
              </style>
            </defs>
            <text x="10" y="45" className="logo-text" fontSize="48" fill="#000000">
              servicen
              <tspan fill="#63DF4E">o</tspan>
              <tspan fill="#000000">w</tspan>
              <tspan fontSize="12" dy="-10">®</tspan>
            </text>
          </svg>
        </div>
        
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-12 h-12" style={{color: '#63DF4E'}} />
            <h1 className="text-4xl font-bold text-white">Security Incident MCP Architecture</h1>
          </div>
          <p className="text-lg" style={{color: '#63DF4E', opacity: 0.8}}>Now Assist + Local AI Collaboration</p>
        </div>

        {/* Flow Selector */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {Object.keys(flows).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedFlow(key)}
              className={`px-4 py-3 rounded-lg font-semibold transition-all text-sm ${
                selectedFlow === key
                  ? 'text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              style={selectedFlow === key ? {backgroundColor: '#63DF4E', color: '#032D42', boxShadow: '0 10px 15px -3px rgba(99, 223, 78, 0.5)'} : {}}
            >
              {flows[key].title}
            </button>
          ))}
        </div>

        {/* Flow Visualization */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 mb-8 border" style={{borderColor: 'rgba(99, 223, 78, 0.3)'}}>
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {flows[selectedFlow].title}
          </h2>
          <div className="space-y-4">
            {flows[selectedFlow].steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="flex items-start gap-4 group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border group-hover:transition-colors" style={{backgroundColor: 'rgba(99, 223, 78, 0.2)', borderColor: 'rgba(99, 223, 78, 0.3)'}}>
                    <Icon className="w-6 h-6" style={{color: '#63DF4E'}} />
                  </div>
                  <div className="flex-1">
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 group-hover:transition-colors" style={{'--hover-border': 'rgba(99, 223, 78, 0.5)'}}>
                      <div className="text-sm font-semibold mb-1" style={{color: '#63DF4E'}}>
                        {step.actor}
                      </div>
                      <div className="text-white">
                        {step.action}
                      </div>
                    </div>
                  </div>
                  {idx < flows[selectedFlow].steps.length - 1 && (
                    <div className="absolute left-6 mt-16 w-0.5 h-8" style={{background: 'linear-gradient(to bottom, #63DF4E, transparent)'}}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MCP Tools */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 border" style={{borderColor: 'rgba(99, 223, 78, 0.3)'}}>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Server className="w-7 h-7" style={{color: '#63DF4E'}} />
            MCP Server Tools to Implement
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {tools.map((tool, idx) => (
              <div
                key={idx}
                className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:transition-colors"
              >
                <div className="font-mono font-semibold mb-2" style={{color: '#63DF4E'}}>
                  {tool.name}
                </div>
                <div className="text-slate-300 text-sm">
                  {tool.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Implementation Steps */}
        <div className="mt-8 rounded-xl p-6 border" style={{background: 'linear-gradient(to right, rgba(99, 223, 78, 0.1), rgba(3, 45, 66, 0.5))', borderColor: 'rgba(99, 223, 78, 0.3)'}}>
          <h3 className="text-xl font-bold text-white mb-4">Quick Start Implementation</h3>
          <ol className="space-y-3 text-slate-200">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{backgroundColor: '#63DF4E', color: '#032D42'}}>1</span>
              <span>Build Python MCP server with security-focused tools (threat analysis, vuln correlation)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{backgroundColor: '#63DF4E', color: '#032D42'}}>2</span>
              <span>Connect your local AI (Claude API, Ollama, etc.) to the MCP server</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{backgroundColor: '#63DF4E', color: '#032D42'}}>3</span>
              <span>Configure ServiceNow MCP client to connect to your server (requires Now Assist SKU)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{backgroundColor: '#63DF4E', color: '#032D42'}}>4</span>
              <span>Create AI Agent in ServiceNow that uses your MCP tools for security workflows</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default SecurityMCPArchitecture;