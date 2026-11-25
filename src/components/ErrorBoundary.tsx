/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  moduleName?: string;
  onResetToHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack?: string;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: '',
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Une erreur inattendue est survenue.',
      errorStack: error?.stack || '',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.moduleName ? ` - ${this.props.moduleName}` : ''}]:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '', errorStack: '', showDetails: false });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, errorMessage: '', errorStack: '', showDetails: false });
    if (this.props.onResetToHome) {
      this.props.onResetToHome();
    } else {
      window.location.hash = '#/';
    }
  };

  handleResetModuleCache = () => {
    try {
      if (this.props.moduleName?.includes('Rythmes')) {
        localStorage.removeItem('voxart_studio_composition');
      }
    } catch {
      // ignore
    }
    this.handleRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-lg mx-auto my-6 p-6 rounded-3xl bg-[#1c0f04] border-2 border-[#fbbf24]/40 text-[#fef3c7] space-y-4 text-center shadow-2xl animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-[#ea580c]/20 border border-[#f59e0b]/50 flex items-center justify-center mx-auto text-[#f59e0b]">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-[#fbbf24] tracking-tight">
              {this.props.moduleName ? `Incident dans ${this.props.moduleName}` : 'Incident isolé'}
            </h2>
            <p className="text-xs text-[#fde68a]/80 leading-relaxed max-w-sm mx-auto">
              Ce module a rencontré une anomalie d'exécution. Les autres fonctionnalités et données du studio restent préservées.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={this.handleGoHome}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1c0f04] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-lg"
            >
              <Home className="w-4 h-4" />
              <span>Retour à l'accueil</span>
            </button>
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#2b1708] text-[#fbbf24] border border-[#fbbf24]/40 font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#3d200a] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Réessayer</span>
            </button>
          </div>

          {/* Collapsible Error Diagnostics */}
          <div className="pt-2 border-t border-[#fbbf24]/20 text-left">
            <button
              type="button"
              onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
              className="w-full flex items-center justify-between text-[11px] font-mono text-[#fde68a]/60 hover:text-[#fbbf24] py-1 transition-colors"
            >
              <span>Détails techniques du diagnostic :</span>
              {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {this.state.showDetails && (
              <div className="mt-2 p-3 rounded-xl bg-[#140c06] border border-[#fbbf24]/20 space-y-2 text-[10px] font-mono text-[#fca5a5] break-words max-h-48 overflow-y-auto">
                <div className="font-bold text-[#f87171]">Message : {this.state.errorMessage}</div>
                {this.state.errorStack && (
                  <pre className="text-[9px] text-[#fde68a]/50 whitespace-pre-wrap leading-tight">
                    {this.state.errorStack.slice(0, 500)}
                  </pre>
                )}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={this.handleResetModuleCache}
                    className="px-2 py-1 rounded-lg bg-[#3d1a0a] text-[#fbbf24] hover:bg-[#52240e] text-[9px] font-bold flex items-center gap-1 border border-[#fbbf24]/30"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Réinitialiser les données locales</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
