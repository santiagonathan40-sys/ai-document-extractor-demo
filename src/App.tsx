import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  X, 
  Upload, 
  Trash2, 
  HelpCircle,
  TableProperties, 
  Download, 
  ExternalLink,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Briefcase,
  Terminal,
  Cpu,
  Database,
  Workflow,
  Sparkles,
  FlaskConical,
  Wand2
} from "lucide-react";
import { USE_CASES, MOCK_EXTRACTION_RESULTS, POPULAR_FIELD_SUGGESTIONS } from "./data";
import { ExtractionResult } from "./types";

export default function App() {
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [activeFields, setActiveFields] = useState<string[]>(["Client Name", "Invoice Number", "Total Amount", "Due Date"]);
  const [inputText, setInputText] = useState("");
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [customFieldText, setCustomFieldText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResults, setExtractionResults] = useState<ExtractionResult[]>(MOCK_EXTRACTION_RESULTS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [loadingText, setLoadingText] = useState("AI is scanning documents...");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const processingLabRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isExtracting) return;
    const texts = [
      "Uploading files safely...",
      "Analyzing document layout and structure...",
      "OCR engines detecting printed text...",
      "AI engine processing semantic context...",
      "Extracting requested target fields...",
      "Structuring results into dynamic JSON..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLoadingText(texts[i % texts.length]);
      i++;
    }, 1500);
    return () => clearInterval(interval);
  }, [isExtracting]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndAddFiles = (filesList: FileList) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const validFiles: File[] = [];
    
    if (stagedFiles.length + filesList.length > 3) {
      setErrorMsg("Demo limitation: You can upload a maximum of 3 PDF files at once.");
      return;
    }

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMsg(`'${file.name}' is not a PDF. This demo currently supports PDF files only.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(`'${file.name}' exceeds the 5MB size limit. Please upload a smaller file.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setStagedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndAddFiles(e.target.files);
    }
  };

  const removeStagedFile = (indexToRemove: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const addField = (fieldName: string) => {
    const trimmed = fieldName.trim();
    if (!trimmed) return;
    
    if (activeFields.includes(trimmed)) {
      setErrorMsg(`'${trimmed}' is already added as a target field.`);
      return;
    }
    
    if (activeFields.length >= 5) {
      setErrorMsg("Demo limitation: Maximum of 5 target fields can be extracted at once.");
      return;
    }

    setActiveFields(prev => [...prev, trimmed]);
    setCustomFieldText("");
    setShowAddDropdown(false);
    setErrorMsg(null);
  };

  const removeField = (fieldToRemove: string) => {
    setActiveFields(prev => prev.filter(f => f !== fieldToRemove));
    setErrorMsg(null);
  };

  const handleAutoParseFields = () => {
    if (!inputText.trim()) return;
    
    const words = inputText.split(/[;,]|\band\b|\bor\b/).map(w => w.trim()).filter(Boolean);
    let addedCount = 0;
    const newFields = [...activeFields];

    for (const word of words) {
      let cleanWord = word.replace(/^(extract|find|get|the|please find|show|me)\s+/i, "").trim();
      cleanWord = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);

      if (cleanWord && !newFields.includes(cleanWord) && newFields.length < 5) {
        newFields.push(cleanWord);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      setActiveFields(newFields);
      setSuccessMsg(`Parsed and added ${addedCount} field(s) from your text!`);
      setInputText("");
    } else if (newFields.length >= 5) {
      setErrorMsg("Maximum of 5 target fields has already been reached.");
    } else {
      setErrorMsg("Could not detect any new distinct fields. Try typing them separated by commas.");
    }
  };

  const handleExtractData = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (stagedFiles.length === 0) {
      setErrorMsg("Please upload or drag at least one PDF file to extract.");
      processingLabRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (activeFields.length === 0) {
      setErrorMsg("Please specify at least one target field for extraction.");
      return;
    }

    setIsExtracting(true);

    const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

    try {
      const formData = new FormData();
      stagedFiles.forEach(file => {
        formData.append("files", file);
      });
      
      formData.append("fields", JSON.stringify(activeFields));

      const response = await fetch(`${apiUrl}/extract`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || "An error occurred during document extraction.");
      }

      const mappedResults: ExtractionResult[] = data.rows.map((row: any) => {
        const { "File Name": fileName, Status, ...rest } = row;
        return {
          fileName: fileName || "document.pdf",
          status: Status === "Extracted" ? "Extracted" : "Failed",
          data: rest,
          error: Status !== "Extracted" ? Status : undefined
        };
      });

      setExtractionResults(mappedResults);
      setSuccessMsg(`Successfully processed ${stagedFiles.length} file(s)! Real-time extraction complete.`);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);

    } catch (err: any) {
      console.error("Extraction error:", err);
      setErrorMsg(err.message || "Failed to connect to backend server. Ensure backend is running and configured.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Download XLSX or CSV File from server
  const downloadExport = async (format: "csv" | "xlsx") => {
    setErrorMsg(null);
    if (extractionResults.length === 0) {
      setErrorMsg("No extracted results are available to export.");
      return;
    }

    const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

    try {
      const flatRows = extractionResults.map(result => ({
        "File Name": result.fileName,
        ...result.data,
        "Status": result.status
      }));

      const response = await fetch(`${apiUrl}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rows: flatRows,
          format
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate export file.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `extracted_document_data.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg(`Downloaded extracted data in ${format.toUpperCase()} format!`);
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorMsg("Could not export. Please check backend connection.");
    }
  };

  const handleSelectUseCase = (useCase: typeof USE_CASES[0]) => {
    setActiveFields(useCase.fields);
    setSuccessMsg(`Loaded fields configuration for the '${useCase.title}' use case!`);
    processingLabRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToSection = (elementRef: React.RefObject<HTMLDivElement | null>) => {
    elementRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#0a0a0c] overflow-x-hidden text-[#e5e1e4] font-sans selection:bg-[#00f2ff]/20 selection:text-[#00f2ff]">
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[600px] h-[600px] bg-[#00f2ff]/5 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute top-1/2 right-1/4 translate-x-1/2 w-[500px] h-[500px] bg-[#bc13fe]/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 md:px-20 lg:px-40 flex justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[1280px] flex-1">
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-white/10 px-4 md:px-10 py-3 mb-10">
              <div className="flex items-center gap-3 text-white">
                <div className="size-8 text-[#00f2ff]">
                  <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor"></path>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <h2 id="logo-header" className="text-white text-lg font-black leading-none tracking-tight neon-text uppercase font-sans">
                    Carl Santiago
                  </h2>
                  <span className="text-[9px] text-[#00f2ff] tracking-[0.2em] font-mono font-bold uppercase">Digital Systems Developer</span>
                </div>
              </div>
              
              <div className="hidden md:flex flex-1 justify-end gap-8">
                <nav className="flex items-center gap-9">
                  <a className="text-[#b9cacb] text-sm font-medium leading-normal hover:text-[#00f2ff] transition-colors" href="#">Dashboard</a>
                  <a className="text-[#b9cacb] text-sm font-medium leading-normal hover:text-[#00f2ff] transition-colors" href="#use-cases">Use Cases</a>
                  <a className="text-[#b9cacb] text-sm font-medium leading-normal hover:text-[#00f2ff] transition-colors" href="#how-it-works">How It Works</a>
                  <a className="text-[#b9cacb] text-sm font-medium leading-normal hover:text-[#00f2ff] transition-colors" href="#tech-stack">Tech Stack</a>
                </nav>
                <div className="flex gap-2">
                  <button 
                    onClick={() => scrollToSection(processingLabRef)}
                    id="try-demo-btn"
                    className="flex min-w-[110px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-6 bg-gradient-to-r from-[#00f2ff] to-[#2962ff] text-[#0a0a0c] text-sm font-extrabold leading-normal hover:brightness-110 active:scale-95 transition-all neon-glow-cyan"
                  >
                    Try Demo
                  </button>
                  <a 
                    href="mailto:santiagonathan40@gmail.com?subject=Custom%20AI%20Document%20Automation%20Inquiry"
                    className="flex cursor-pointer items-center justify-center rounded-full size-10 bg-[#1c1b1d] border border-white/10 text-white hover:text-[#00f2ff] hover:border-[#00f2ff]/30 active:scale-95 transition-all"
                    title="Request Custom Automation"
                  >
                    <span className="material-symbols-outlined text-[20px]">science</span>
                  </a>
                </div>
              </div>
            </header>

            <div className="px-4 max-w-[1280px] mx-auto w-full mb-6">
              {errorMsg && (
                <div className="flex items-start gap-3 bg-red-950/30 border border-red-500/30 p-4 rounded-xl text-red-200 text-sm animate-fade-in">
                  <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-bold text-red-400 font-mono text-xs uppercase tracking-wider">Action Required</h5>
                    <p className="mt-1 text-xs text-red-300">{errorMsg}</p>
                  </div>
                  <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white transition-colors">
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-3 bg-green-950/30 border border-green-500/30 p-4 rounded-xl text-green-200 text-sm animate-fade-in">
                  <CheckCircle className="size-5 text-green-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-bold text-green-400 font-mono text-xs uppercase tracking-wider">Success</h5>
                    <p className="mt-1 text-xs text-green-300">{successMsg}</p>
                  </div>
                  <button onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-white transition-colors">
                    <X className="size-4" />
                  </button>
                </div>
              )}
            </div>

            <main className="flex flex-col gap-16 px-4">
              <section className="flex flex-col lg:flex-row gap-12 items-center">
                
                <div className="flex-1 space-y-6">

                  <h1 className="text-[#e1fdff] text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
                    Turn Documents Into <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#bc13fe]">Clean Spreadsheet Data</span>
                  </h1>
                  <p className="text-[#b9cacb] text-base md:text-lg max-w-xl leading-relaxed font-sans">
                    Upload sample PDF files, choose the details you want to extract, and preview how AI can organize messy business documents into CSV, Excel, or Google Sheets-ready data.
                  </p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-3 py-1.5 rounded-full bg-[#1c1b1d] border border-white/10 text-[11px] font-mono font-medium text-[#e5e1e4] flex items-center gap-1.5 hover:border-[#00f2ff]/30 hover:shadow-[0_0_12px_rgba(0,242,255,0.1)] transition-all">
                      <Terminal className="size-3 text-[#00f2ff]" /> Python Automation
                    </span>
                    <span className="px-3 py-1.5 rounded-full bg-[#1c1b1d] border border-white/10 text-[11px] font-mono font-medium text-[#e5e1e4] flex items-center gap-1.5 hover:border-[#00f2ff]/30 hover:shadow-[0_0_12px_rgba(0,242,255,0.1)] transition-all">
                      <Cpu className="size-3 text-[#00f2ff]" /> AI Data Extraction
                    </span>
                    <span className="px-3 py-1.5 rounded-full bg-[#1c1b1d] border border-white/10 text-[11px] font-mono font-medium text-[#e5e1e4] flex items-center gap-1.5 hover:border-[#00f2ff]/30 hover:shadow-[0_0_12px_rgba(0,242,255,0.1)] transition-all">
                      <FileText className="size-3 text-[#00f2ff]" /> PDF Format
                    </span>
                    <span className="px-3 py-1.5 rounded-full bg-[#1c1b1d] border border-white/10 text-[11px] font-mono font-medium text-[#e5e1e4] flex items-center gap-1.5 hover:border-[#bc13fe]/30 hover:shadow-[0_0_12px_rgba(188,19,254,0.1)] transition-all">
                      <Database className="size-3 text-[#bc13fe]" /> Excel / CSV Output
                    </span>
                    <span className="px-3 py-1.5 rounded-full bg-[#1c1b1d] border border-white/10 text-[11px] font-mono font-medium text-[#e5e1e4] flex items-center gap-1.5 hover:border-[#bc13fe]/30 hover:shadow-[0_0_12px_rgba(188,19,254,0.1)] transition-all">
                      <Workflow className="size-3 text-[#bc13fe]" /> CRM-Ready Schema
                    </span>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-[#1c1b1d] border border-white/10 text-xs text-[#b9cacb] flex gap-3">
                    <div className="size-5 rounded-full bg-[#00f2ff]/10 flex items-center justify-center text-[#00f2ff] shrink-0">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                    </div>
                    <div>
                      <p className="font-bold text-white">Pro Tip for Evaluators</p>
                      <p className="mt-0.5">Click any use case card below to automatically load custom configurations (like Invoices, Mortgage files, or Donor records) directly into the lab!</p>
                    </div>
                  </div>
                </div>

                <div ref={processingLabRef} className="flex-1 w-full relative">
                  <div className="absolute -inset-4 bg-[#00f2ff]/5 blur-3xl rounded-full"></div>
                  <div className="glass-card rounded-lg p-6 md:p-8 relative border border-white/10 photon-shadow-hover transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-xl flex items-center gap-2 text-white font-sans">
                        <span className="material-symbols-outlined text-[#00f2ff] text-2xl">science</span>
                        Processing Lab
                      </h3>
                      <span className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono font-bold border border-red-500/20">
                        Demo Mode
                      </span>
                    </div>

                    {stagedFiles.length > 0 && (
                      <div className="mb-4 bg-[#0e0e10]/80 border border-white/10 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                          <span className="text-xs font-bold text-[#00f2ff] font-mono uppercase tracking-wider">
                            Uploaded Documents ({stagedFiles.length}/3)
                          </span>
                          <button 
                            onClick={() => setStagedFiles([])} 
                            className="text-xs text-[#b9cacb] hover:text-red-400 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="size-3" /> Clear All
                          </button>
                        </div>
                        {stagedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-[#1c1b1d]/80 p-2 rounded text-xs border border-white/5">
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileText className="size-4 text-[#00f2ff] shrink-0" />
                              <span className="font-mono text-[#e5e1e4] truncate">{file.name}</span>
                              <span className="text-[10px] text-[#b9cacb]/60">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                            <button 
                              onClick={() => removeStagedFile(idx)} 
                              className="text-[#b9cacb] hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all"
                              title="Remove file"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div 
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`dashed-border p-8 md:p-12 flex flex-col items-center justify-center gap-4 bg-[#00f2ff]/3 hover:bg-[#00f2ff]/6 transition-all cursor-pointer group ${dragActive ? "border-[#00f2ff] bg-[#00f2ff]/10" : ""}`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange}
                        multiple 
                        accept="application/pdf"
                        className="hidden" 
                      />
                      <div className="size-16 rounded-full bg-[#00f2ff]/10 flex items-center justify-center text-[#00f2ff] group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl">upload_file</span>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-white font-extrabold text-lg">Drag &amp; Drop PDF Files</p>
                        <p className="text-[#b9cacb] text-xs max-w-xs mx-auto">
                          Click to select or drag and drop. PDF files only for this demo.
                        </p>
                      </div>
                      <button 
                        type="button"
                        className="mt-2 px-5 py-2 bg-[#00f2ff] text-[#0a0a0c] font-extrabold text-xs uppercase tracking-wider rounded-full hover:brightness-110 active:scale-95 transition-all"
                      >
                        Select Files
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-[#1c1b1d]/40 border border-white/5 text-xs text-[#b9cacb] space-y-1">
                        <h5 className="font-bold text-white flex items-center gap-1.5 font-mono uppercase tracking-wider text-[10px] text-[#00f2ff]">
                          <span className="material-symbols-outlined text-[14px]">shield</span> Privacy Note
                        </h5>
                        <p className="leading-relaxed">
                          Demo files are processed temporarily and are not stored permanently. Please use sample or non-confidential documents for testing. <strong className="text-[#00f2ff]">In a real-case scenario, this system can process 1000+ files in minutes.</strong>
                        </p>
                      </div>
                      
                      <div className="p-4 rounded-lg bg-[#1c1b1d]/40 border border-white/5 text-xs text-[#b9cacb] space-y-1">
                        <h5 className="font-bold text-white flex items-center gap-1.5 font-mono uppercase tracking-wider text-[10px] text-[#bc13fe]">
                          <span className="material-symbols-outlined text-[14px]">speed</span> Demo Limits
                        </h5>
                        <ul className="list-style-none space-y-0.5 leading-relaxed text-[11px] list-disc list-inside">
                          <li>Up to 3 PDF files</li>
                          <li>Maximum 5MB per file</li>
                          <li>PDF only for this demo</li>
                          <li>Up to 5 extraction fields</li>
                          <li>Sample or non-confidential documents only</li>
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-sm font-bold text-[#e1fdff]">
                            What information do you want to extract?
                          </label>
                          <span className="text-[10px] text-[#00f2ff] flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">bolt</span> Real AI parsing
                          </span>
                        </div>
                        <div className="relative">
                          <input 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAutoParseFields()}
                            className="w-full bg-[#0e0e10] border border-white/10 rounded-lg pl-4 pr-12 py-3.5 focus:ring-2 focus:ring-[#00f2ff] focus:border-[#00f2ff] outline-none text-white font-medium text-sm transition-all placeholder:text-[#b9cacb]/40" 
                            placeholder="e.g. Total amount from invoice, due date, vendor name..." 
                            type="text"
                          />
                          <button 
                            type="button"
                            onClick={handleAutoParseFields}
                            className="absolute right-2 top-2 p-1.5 text-[#00f2ff] hover:text-white hover:bg-[#00f2ff]/15 rounded-lg transition-all"
                            title="Auto-detect fields from text"
                          >
                            <span className="material-symbols-outlined">auto_fix_high</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-[#b9cacb]/60 mt-1 font-mono">
                          Tip: Type a prompt and click the wizard wand to extract tags instantly!
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-bold text-[#e1fdff]">Target Fields ({activeFields.length}/5)</label>
                          <span className="text-[10px] text-[#b9cacb]/50 italic">Required: min 1, max 5</span>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-[#0e0e10] rounded-lg border border-white/10 min-h-[50px]">
                          {activeFields.map((field) => (
                            <div 
                              key={field} 
                              className="flex items-center gap-1.5 bg-[#00f2ff]/10 border border-[#00f2ff]/20 text-[#00f2ff] pl-3 pr-1.5 py-1 rounded-full text-xs font-mono font-semibold"
                            >
                              <span>{field}</span>
                              <button 
                                type="button" 
                                onClick={() => removeField(field)} 
                                className="hover:bg-[#00f2ff]/20 p-0.5 rounded-full transition-all shrink-0"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ))}

                          {activeFields.length < 5 && (
                            <div className="relative" ref={dropdownRef}>
                              <button 
                                type="button"
                                onClick={() => setShowAddDropdown(!showAddDropdown)}
                                className="flex items-center gap-1 text-[#b9cacb] hover:text-[#00f2ff] px-3 py-1 border border-dashed border-white/20 hover:border-[#00f2ff]/40 rounded-full text-xs font-medium transition-all"
                              >
                                <Plus className="size-3" />
                                Add Field
                                <ChevronDown className="size-3 opacity-60" />
                              </button>

                              {showAddDropdown && (
                                <div className="absolute left-0 mt-2 w-64 bg-[#201f21] border border-white/10 rounded-lg shadow-2xl p-3 z-50 animate-fade-in text-xs">
                                  <p className="font-bold text-white mb-2 pb-1 border-b border-white/10 uppercase tracking-wider font-mono text-[10px] text-[#00f2ff]">
                                    Popular Suggested Fields
                                  </p>
                                  <div className="max-h-40 overflow-y-auto scroll-hide space-y-1 mb-3">
                                    {POPULAR_FIELD_SUGGESTIONS.map((suggestion) => (
                                      <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => addField(suggestion)}
                                        disabled={activeFields.includes(suggestion)}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#00f2ff]/10 text-[#b9cacb] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex justify-between items-center"
                                      >
                                        <span>{suggestion}</span>
                                        {activeFields.includes(suggestion) && <span className="text-[10px] bg-white/10 text-[#b9cacb] px-1 rounded font-mono">Added</span>}
                                      </button>
                                    ))}
                                  </div>

                                  <p className="font-bold text-white mb-1.5 uppercase tracking-wider font-mono text-[10px] text-[#00f2ff]">
                                    Add Custom Field
                                  </p>
                                  <div className="flex gap-1">
                                    <input 
                                      type="text" 
                                      value={customFieldText}
                                      onChange={(e) => setCustomFieldText(e.target.value)}
                                      onKeyDown={(e) => e.key === "Enter" && addField(customFieldText)}
                                      placeholder="e.g. Due Date" 
                                      className="flex-1 bg-[#0e0e10] border border-white/10 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-[#00f2ff] outline-none"
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => addField(customFieldText)}
                                      className="bg-gradient-to-r from-[#00f2ff] to-[#2962ff] text-[#0a0a0c] px-3 py-1 rounded font-black hover:brightness-110 active:scale-95 transition-all text-xs"
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <button 
                        type="button"
                        onClick={handleExtractData}
                        disabled={isExtracting}
                        className={`w-full py-4 bg-gradient-to-r from-[#00f2ff] to-[#2962ff] text-[#0a0a0c] font-black text-lg rounded-full shadow-[0_0_20px_rgba(0,242,255,0.2)] hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2 ${isExtracting ? "opacity-90 cursor-not-allowed" : ""}`}
                      >
                        {isExtracting ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                            <span>{loadingText}</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xl">magic_button</span>
                            <span>Extract Data</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section id="how-it-works" className="py-12 border-y border-white/10">
                <h2 className="text-center text-3xl font-extrabold mb-12 neon-text text-white">How It Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                  
                  <div className="flex flex-col items-center text-center group">
                    <div className="size-16 rounded-lg bg-[#1c1b1d] border border-white/10 flex items-center justify-center mb-4 group-hover:border-[#00f2ff]/40 group-hover:shadow-[0_0_20px_rgba(0,242,255,0.15)] transition-all">
                      <span className="material-symbols-outlined text-3xl text-[#00f2ff]">cloud_upload</span>
                    </div>
                    <h4 className="font-bold text-lg text-[#e1fdff] mb-2">1. Upload PDFs</h4>
                    <p className="text-xs text-[#b9cacb] max-w-xs leading-relaxed">
                      Drop your document PDFs (up to 3 files, 5MB max) directly into our sandbox.
                    </p>
                  </div>

                  <div className="hidden md:flex items-center justify-center text-[#2962ff] mt-[-32px]">
                    <span className="material-symbols-outlined text-3xl">trending_flat</span>
                  </div>

                  <div className="flex flex-col items-center text-center group">
                    <div className="size-16 rounded-lg bg-[#1c1b1d] border border-white/10 flex items-center justify-center mb-4 group-hover:border-[#00f2ff]/40 group-hover:shadow-[0_0_20px_rgba(0,242,255,0.15)] transition-all">
                      <span className="material-symbols-outlined text-3xl text-[#00f2ff]">rule</span>
                    </div>
                    <h4 className="font-bold text-lg text-[#e1fdff] mb-2">2. Define Target Fields</h4>
                    <p className="text-xs text-[#b9cacb] max-w-xs leading-relaxed">
                      Specify up to 5 properties (such as Renewal Date, Borrower, or Invoice Number).
                    </p>
                  </div>

                  <div className="hidden md:flex items-center justify-center text-[#2962ff] mt-[-32px]">
                    <span className="material-symbols-outlined text-3xl">trending_flat</span>
                  </div>

                  <div className="flex flex-col items-center text-center group">
                    <div className="size-16 rounded-lg bg-[#1c1b1d] border border-white/10 flex items-center justify-center mb-4 group-hover:border-[#bc13fe]/40 group-hover:shadow-[0_0_20px_rgba(188,19,254,0.15)] transition-all">
                      <span className="material-symbols-outlined text-3xl text-[#bc13fe]">psychology</span>
                    </div>
                    <h4 className="font-bold text-lg text-[#e1fdff] mb-2">3. Extract and Export</h4>
                    <p className="text-xs text-[#b9cacb] max-w-xs leading-relaxed">
                      Our advanced AI extracts structured fields into a tabular view for instant CSV/Excel download.
                    </p>
                  </div>
                </div>
              </section>

              <section ref={resultsRef} className="space-y-6 pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                  <div>
                    <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
                      <TableProperties className="size-8 text-[#00f2ff]" />
                      Results Preview
                    </h2>
                    <p className="text-[#b9cacb] text-sm mt-1">
                      Review structural fields parsed by AI before exporting. <span className="text-[#00f2ff]/80 block md:inline md:ml-2 text-xs font-mono">(* If a requested field is not found, the result will show "Not found" instead of guessing.)</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button 
                      onClick={() => downloadExport("xlsx")}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1c1b1d] border border-white/10 rounded-full text-xs font-bold hover:bg-[#2a2a2c] text-white transition-all shadow"
                    >
                      <span className="material-symbols-outlined text-green-400 text-sm">table_chart</span>
                      Download Excel
                    </button>
                    <button 
                      onClick={() => downloadExport("csv")}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1c1b1d] border border-white/10 rounded-full text-xs font-bold hover:bg-[#2a2a2c] text-white transition-all shadow"
                    >
                      <span className="material-symbols-outlined text-blue-400 text-sm">csv</span>
                      Download CSV
                    </button>

                  </div>
                </div>

                <div className="glass-card rounded-lg overflow-hidden border border-white/10 shadow-2xl">
                  <div className="overflow-x-auto scroll-hide">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#1c1b1d] border-b border-white/10">
                          <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-[#00f2ff] font-mono min-w-[180px]">File Name</th>
                          {activeFields.map((field) => (
                            <th key={field} className="px-6 py-4 text-xs font-black uppercase tracking-wider text-[#00f2ff] font-mono min-w-[150px]">
                              {field}
                            </th>
                          ))}
                          <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-[#00f2ff] font-mono min-w-[100px]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {extractionResults.map((result, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-white flex items-center gap-2">
                              <FileText className="size-4 text-[#00f2ff] shrink-0" />
                              <span className="truncate max-w-[200px]">{result.fileName}</span>
                            </td>
                            {activeFields.map((field) => {
                              const value = result.data?.[field] || "Not found";
                              const isNotFound = value === "Not found" || value === "Extraction error";
                              return (
                                <td key={field} className="px-6 py-4">
                                  <span className={`font-mono text-xs ${isNotFound ? "text-[#b9cacb]/40 italic" : "text-[#e5e1e4] font-medium"}`}>
                                    {value}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                                result.status === "Extracted" 
                                  ? "bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/20" 
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}>
                                {result.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section id="use-cases" className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-extrabold text-white">Popular Use Cases</h2>
                  <p className="text-[#b9cacb] max-w-xl mx-auto text-sm leading-relaxed">
                    Our AI-driven pipeline seamlessly adapts to any structured or unstructured business document. Click any card below to test custom target fields instantly.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {USE_CASES.map((uc) => (
                    <div 
                      key={uc.id} 
                      onClick={() => handleSelectUseCase(uc)}
                      className="glass-card p-6 rounded-lg border border-white/10 hover:border-[#bc13fe]/50 hover:bg-[#bc13fe]/5 cursor-pointer group transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(188,19,254,0.15)]"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="size-11 rounded-lg bg-[#bc13fe]/10 border border-[#bc13fe]/20 flex items-center justify-center text-[#ebb2ff] group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[22px]">{uc.icon}</span>
                        </div>
                        <span className="text-[10px] text-[#00f2ff] font-mono opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          Load Preset <ExternalLink className="size-2.5" />
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-[#e1fdff] mb-1.5">{uc.title}</h3>
                      <p className="text-[#b9cacb] text-xs leading-relaxed mb-4">{uc.description}</p>
                      
                      <div className="space-y-1.5 border-t border-white/10 pt-3">
                        <span className="text-[10px] font-bold text-[#00f2ff] uppercase font-mono tracking-wider">
                          Preset Target Fields:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {uc.fields.map((field) => (
                            <span key={field} className="text-[10px] bg-[#1c1b1d] border border-white/10 text-[#b9cacb] px-2 py-0.5 rounded-full font-mono">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="tech-stack" className="text-center py-10 border-t border-white/10">

                <div className="flex flex-wrap justify-center items-center gap-4 opacity-90">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold bg-[#1c1b1d] border border-white/10 hover:border-[#00f2ff]/40 text-[#e5e1e4] px-4 py-2 rounded-full hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] transition-all cursor-default">
                    <span className="material-symbols-outlined text-[16px] text-[#00f2ff]">terminal</span> Python
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold bg-[#1c1b1d] border border-white/10 hover:border-[#00f2ff]/40 text-[#e5e1e4] px-4 py-2 rounded-full hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] transition-all cursor-default">
                    <span className="material-symbols-outlined text-[16px] text-[#00f2ff]">api</span> FastAPI or Backend API
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold bg-[#1c1b1d] border border-white/10 hover:border-[#00f2ff]/40 text-[#e5e1e4] px-4 py-2 rounded-full hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] transition-all cursor-default">
                    <span className="material-symbols-outlined text-[16px] text-[#bc13fe]">psychology</span> AI Data Extraction
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold bg-[#1c1b1d] border border-white/10 hover:border-[#00f2ff]/40 text-[#e5e1e4] px-4 py-2 rounded-full hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] transition-all cursor-default">
                    <span className="material-symbols-outlined text-[16px] text-[#00f2ff]">picture_as_pdf</span> PDF Processing
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold bg-[#1c1b1d] border border-white/10 hover:border-[#00f2ff]/40 text-[#e5e1e4] px-4 py-2 rounded-full hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] transition-all cursor-default">
                    <span className="material-symbols-outlined text-[16px] text-[#bc13fe]">analytics</span> Pandas
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold bg-[#1c1b1d] border border-white/10 hover:border-[#00f2ff]/40 text-[#e5e1e4] px-4 py-2 rounded-full hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] transition-all cursor-default">
                    <span className="material-symbols-outlined text-[16px] text-[#00f2ff]">grid_on</span> CSV / Excel Export
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold bg-[#1c1b1d] border border-white/10 hover:border-[#00f2ff]/40 text-[#e5e1e4] px-4 py-2 rounded-full hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] transition-all cursor-default">
                    <span className="material-symbols-outlined text-[16px] text-[#bc13fe]">cloud_sync</span> Google Sheets Ready
                  </div>
                </div>
              </section>

              <section className="py-12 mt-8 border-t border-white/10">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1c1b1d] via-[#121113] to-[#1c1b1d] border border-white/10 p-8 md:p-12 text-center space-y-6">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#00f2ff]/5 blur-3xl rounded-full pointer-events-none"></div>
                  <div className="absolute bottom-0 right-10 w-60 h-60 bg-[#bc13fe]/5 blur-3xl rounded-full pointer-events-none"></div>
                  

                  
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                    Need this customized for your business?
                  </h2>
                  
                  <p className="text-[#e1fdff] text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                    I can build a private document extraction system that scans your files, extracts the exact data you need, and organizes everything into Excel, CSV, or Google Sheets.
                  </p>
                  
                  <p className="text-[#b9cacb] text-sm max-w-xl mx-auto leading-relaxed">
                    Perfect for invoices, mortgage files, donor records, real estate documents, client forms, reports, and custom business documents.
                  </p>

                  <div className="max-w-2xl mx-auto p-4 rounded-lg bg-[#0e0e10]/80 border border-white/5 text-xs text-[#b9cacb] text-left space-y-1.5">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-[#00f2ff]" />
                      Portfolio &amp; Custom Integration Features:
                    </p>
                    <p className="text-left leading-relaxed">
                      This demo is limited for portfolio testing. The full private version can be customized to scan Google Drive folders, local computer folders, client-specific document types, and send extracted data directly to Google Sheets.
                    </p>
                  </div>
                  
                  <div className="pt-4">
                    <a 
                      href="mailto:santiagonathan40@gmail.com?subject=Custom%20AI%20Document%20Automation%20Inquiry"
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00f2ff] to-[#2962ff] text-[#0a0a0c] font-black text-sm uppercase tracking-wider rounded-full hover:brightness-110 active:scale-95 hover:shadow-[0_0_25px_rgba(0,242,255,0.3)] transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">mail</span>
                      Request Custom Automation
                    </a>
                  </div>
                </div>
              </section>
            </main>

            <footer className="mt-16 py-12 border-t border-solid border-white/10 text-center">
              <div className="flex flex-col items-center justify-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="size-5 text-[#00f2ff]">
                    <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor"></path>
                    </svg>
                  </div>
                  <span className="font-extrabold tracking-[0.05em] text-white text-sm">
                    Built by Carl Santiago
                  </span>
                </div>
                <span className="text-[10px] text-[#00f2ff] tracking-[0.1em] font-mono font-bold uppercase">
                  Full-Stack Developer &amp; GoHighLevel Workflow Expert
                </span>
              </div>
              <p className="text-[#b9cacb]/60 text-xs max-w-md mx-auto leading-relaxed mb-6">
                © 2026 AI Document Data Extractor. All rights reserved.
              </p>
              


              <div className="flex justify-center gap-6 text-xs text-[#b9cacb]/40 font-medium">
                <a className="hover:text-white transition-colors" href="#">Privacy Policy</a>
                <a className="hover:text-white transition-colors" href="#">Terms of Service</a>
                <a className="hover:text-white transition-colors" href="#">Contact Support</a>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
