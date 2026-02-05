import React, { useState, useRef } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ExternalLink, Heart, Globe, Github } from "lucide-react";
import packageJson from '../../../../package.json'; // Import package.json

const AboutDialog = ({ isOpen, onClose }) => {
  const [statusMessage, setStatusMessage] = useState('');
  const contentRef = useRef(null);
  const timeoutRef = useRef(null);
  const [showLicenseDetails, setShowLicenseDetails] = useState(false);
  const [showLibraryDetails, setShowLibraryDetails] = useState(false);

  // Announce status changes to screen readers
  const announceStatus = (message) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setStatusMessage(message);
    timeoutRef.current = setTimeout(() => {
      setStatusMessage('');
      timeoutRef.current = null;
    }, 3000);
  };

  const handleExternalLink = (url, description) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    announceStatus(`Opening ${description} in new tab`);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative"
      aria-modal="true"
      role="dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      <div className="fixed inset-0 bg-overlay" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <DialogPanel className="w-full max-w-2xl max-h-[90vh] bg-background border border-border rounded-lg shadow-lg flex flex-col">
          <div className="p-6 pb-4">
            <DialogTitle id="dialog-title" className="text-lg font-bold text-titles">
              About AudioFunctions+
            </DialogTitle>
            <Description id="dialog-description" className="text-descriptions">
              Information about the project, developers, and licensing
            </Description>
          </div>

          {/* Status announcements */}
          {statusMessage && (
            <div
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
              role="status"
            >
              {statusMessage}
            </div>
          )}

          {/* Content area */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto px-6 space-y-6"
            role="main"
            aria-label="About information"
          >
            {/* EU Funding Info */}
            <div
              className="border rounded-lg p-4"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary), transparent 95%)',
                borderColor: 'color-mix(in srgb, var(--color-primary), transparent 85%)'
              }}
            >
              <div className="flex items-start gap-3">
                {/* Project Logo */}
                <div className="w-12 h-12 flex-shrink-0 mt-0.5">
                  <img
                    src="/logo.svg"
                    alt="SONAIRGRAPH Project Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback to Globe icon if logo fails to load
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                  <Globe
                    className="w-12 h-12 hidden"
                    style={{ color: 'var(--color-primary)' }}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-md font-semibold text-titles mb-2">
                    SONAIRGRAPH
                  </h2>
                  <p className="text-sm text-descriptions mb-3">
                    Audiofunctions+ is part of the SONAIRGRAPH project, which is co-funded by the European Union.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleExternalLink('https://www.sonairgraph.unito.it/', 'project information site')}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-80 underline transition-opacity"
                      aria-label="Visit project information website"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      Project Information
                    </button>

                    {/* GitHub Button */}
                    <button
                      onClick={() => handleExternalLink('https://github.com/SONAIRGRAPH/audiofunctions-plus', 'GitHub repository')}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md transition-colors"
                      aria-label="View source code on GitHub"
                    >
                      <Github className="w-4 h-4" aria-hidden="true" />
                      View on GitHub
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Universities */}
            <div>
              <h2 className="font-semibold text-titles mb-3">Participating Universities in Development</h2>
              <div className="space-y-2 text-descriptions text-sm">
                <div className="flex items-center gap-2 ml-2">
                  <span><strong>Lead of Development and Testing:</strong> Karlsruhe Institute of Technology (KIT)</span>
                </div>
                <div className="ml-2">
                  <span><strong>Partner:</strong> University of Torino (UniTo)</span>
                </div>
                <div className="ml-2">
                  <span><strong>Partner:</strong> University of Granada (UGR)</span>
                </div>
                <div className="ml-2">
                  <span><strong>Partner:</strong> Masaryk University</span>
                </div>
              </div>

              <br />

              {/* Development Team */}
              <h3 className="font-semibold text-titles mb-3">Developers</h3>
              <div className="space-y-2 text-descriptions text-sm">
                <div className="ml-2">
                  <span><strong>Lukas Schölch</strong> (KIT)</span>
                </div>
                <div className="ml-2">
                  <span><strong>Mattia Ducci</strong> (UniTo)</span>
                </div>
                <div className="ml-2">
                  <span><strong>Pedro A García Sánchez</strong> (UGR)</span>
                </div>
                <div className="ml-2">
                  <span><strong>Ondřej Nečas</strong> (Masaryk University)</span>
                </div>
              </div>

              <br />
              <p>
                <span className="font-semibold">Copyright:</span> © 2025 AudioFunctions+ Development Team
              </p>
            </div>

            {/* Copyright & License - Collapsible */}
            <div className="border-t border-border pt-4">
              <div
                onClick={() => setShowLicenseDetails(!showLicenseDetails)}
                className="flex items-center space-x-2 text-md font-semibold text-titles cursor-pointer select-none"
                aria-expanded={showLicenseDetails}
                aria-controls="license-details"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowLicenseDetails(!showLicenseDetails);
                  }
                }}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showLicenseDetails ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>License</span>
              </div>

              {/* License Summary */}
              <div className="mt-2 text-descriptions text-sm">

              </div>

              {/* Collapsible License Details */}
              {showLicenseDetails && (
                <div
                  id="license-details"
                  className="mt-4 animate-in slide-in-from-top-2 duration-300"
                >
                  <div className="space-y-2 text-descriptions text-sm">

                    <p>
                      <strong>AGPL-3.0 license</strong>
                    </p>

                    <div className="bg-elem-background border border-border rounded p-3 mt-3">
                      <p className="text-xs text-descriptions mb-2">
                        <strong>Key provisions:</strong>
                      </p>
                      <ul className="text-xs text-descriptions list-disc list-inside space-y-1 mb-3">
                        <li><strong>Freedom to use</strong> — You can run the program for any purpose</li>
                        <li><strong>Freedom to study and modify</strong> — You can study how the program works and change it</li>
                        <li><strong>Freedom to redistribute</strong> — You can redistribute copies of the original program</li>
                        <li><strong>Freedom to distribute modifications</strong> — You can distribute copies of your modified versions</li>
                        <li><strong>Network copyleft</strong> — If you run a modified version on a server, you must provide source code to users</li>
                      </ul>
                      <p className="text-xs text-descriptions mb-2">
                        <strong>Requirements when redistributing or modifying:</strong>
                      </p>
                      <ul className="text-xs text-descriptions list-disc list-inside space-y-1 mb-3">
                        <li>Preserve copyright notices and license information</li>
                        <li>Provide source code (including any modifications)</li>
                        <li>Use the same AGPL v3 license for derivative works</li>
                        <li>Provide source code to users of network services based on this software</li>
                      </ul>

                      {/* License Requirements */}
                      <div className="mt-4 p-3 bg-background border border-border rounded">
                        <p className="text-xs text-descriptions font-semibold mb-2">License Compliance:</p>
                        <p className="text-xs text-descriptions mb-2">
                          When using, modifying, or redistributing this software, you must:
                        </p>
                        <ul className="text-xs text-descriptions list-disc list-inside space-y-1 mb-3">
                          <li>Include the original copyright notice and license text</li>
                          <li>Make source code available under AGPL v3</li>
                          <li>Indicate any changes made to the original</li>
                          <li>Provide source code to network service users</li>
                        </ul>
                        <div className="bg-elem-background border border-border rounded p-2 font-mono text-xs text-descriptions">
                          "AudioFunctions+ - Copyright © 2025 AudioFunctions+ Development Team. Licensed under AGPL-3.0."
                        </div>
                        <p className="text-xs text-descriptions mt-2">
                          <strong>Important:</strong> The AGPL v3 ensures that all derivative works and network services remain free and open source.
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border">
                        <button
                          onClick={() => handleExternalLink('https://www.gnu.org/licenses/agpl-3.0.html', 'AGPL-3.0 license details')}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-80 underline transition-opacity"
                          aria-label="View full license terms"
                        >
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          View Full License
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Third-party Libraries - Collapsible */}
            <div>
              <div
                onClick={() => setShowLibraryDetails(!showLibraryDetails)}
                className="flex items-center space-x-2 text-md font-semibold text-titles cursor-pointer select-none"
                aria-expanded={showLibraryDetails}
                aria-controls="library-details"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowLibraryDetails(!showLibraryDetails);
                  }
                }}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showLibraryDetails ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>Third-party Libraries</span>
              </div>

              {/* Library Summary */}
              <div className="mt-2 text-sm text-descriptions"> </div>

              {/* Collapsible Library Details */}
              {showLibraryDetails && (
                <div
                  id="library-details"
                  className="mt-4 animate-in slide-in-from-top-2 duration-300"
                >
                  <div className="space-y-3">
                    <div className="text-sm text-descriptions">
                      <p className="mb-2">AudioFunctions+ is built with the following open-source libraries:</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">React</strong><br />
                          <span className="text-xs text-descriptions">User Interface Framework</span><br />
                          <button
                            onClick={() => handleExternalLink('https://reactjs.org', 'React website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            reactjs.org
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">Tone.js</strong><br />
                          <span className="text-xs text-descriptions">Web Audio Synthesis</span><br />
                          <button
                            onClick={() => handleExternalLink('https://tonejs.github.io', 'Tone.js website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            tonejs.github.io
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">JSXGraph</strong><br />
                          <span className="text-xs text-descriptions">Interactive Geometry & Graphing</span><br />
                          <button
                            onClick={() => handleExternalLink('https://jsxgraph.uni-bayreuth.de', 'JSXGraph website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            jsxgraph.uni-bayreuth.de
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">Math.js</strong><br />
                          <span className="text-xs text-descriptions">Mathematical Expression Parser</span><br />
                          <button
                            onClick={() => handleExternalLink('https://mathjs.org', 'Math.js website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            mathjs.org
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">kbar</strong><br />
                          <span className="text-xs text-descriptions">Command Palette</span><br />
                          <button
                            onClick={() => handleExternalLink('https://kbar.vercel.app', 'kbar website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            kbar.vercel.app
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">Headless UI</strong><br />
                          <span className="text-xs text-descriptions">Accessible UI Components</span><br />
                          <button
                            onClick={() => handleExternalLink('https://headlessui.com', 'Headless UI website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            headlessui.com
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">Lucide React</strong><br />
                          <span className="text-xs text-descriptions">Icon Library</span><br />
                          <button
                            onClick={() => handleExternalLink('https://lucide.dev', 'Lucide website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            lucide.dev
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">Tailwind CSS</strong><br />
                          <span className="text-xs text-descriptions">Utility-First CSS Framework</span><br />
                          <button
                            onClick={() => handleExternalLink('https://tailwindcss.com', 'Tailwind CSS website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            tailwindcss.com
                          </button>
                        </div>

                        <div className="bg-elem-background border border-border rounded p-3">
                          <strong className="text-titles">Vite</strong><br />
                          <span className="text-xs text-descriptions">Build Tool & Dev Server</span><br />
                          <button
                            onClick={() => handleExternalLink('https://vitejs.dev', 'Vite website')}
                            className="text-xs text-primary hover:opacity-80 underline transition-opacity"
                          >
                            vitejs.dev
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Version Info */}
            <div>
              <h2 className="font-semibold text-titles mb-3">Version Information</h2>
              <div className="text-sm pb-4 text-descriptions space-y-1">
                <p><strong>Version:</strong> {packageJson.version}</p>
                <p><strong>Build Date:</strong> {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="btn-primary"
                aria-label="Close about dialog"
              >
                Close
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AboutDialog;
