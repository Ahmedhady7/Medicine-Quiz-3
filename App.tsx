
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend, AreaChart, Area 
} from 'recharts';
import { TRANSLATIONS } from './constants';
import { Difficulty, QuestionType, User, Subject, Quiz, QuizAttempt } from './types';
import { generateQuizQuestions } from './services/geminiService';

// إعداد عامل الـ PDF بشكل مستقر
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

/** --- Helpers for Sharing --- */
const encodeQuiz = (quiz: Quiz) => btoa(encodeURIComponent(JSON.stringify(quiz)));
const decodeQuiz = (data: string): Quiz | null => {
  try { 
    const decoded = atob(data);
    const uriDecoded = decodeURIComponent(decoded);
    return JSON.parse(uriDecoded); 
  } 
  catch (e) { 
    console.error("Import error:", e);
    return null; 
  }
};

/** --- Robust Text and Image Extraction --- */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const processFilesForGemini = async (files: File[], type: QuestionType, enabledTypes?: QuestionType[]) => {
  let combinedText = "";
  const images: { inlineData: { data: string, mimeType: string } }[] = [];
  const isPractical = type === QuestionType.PRACTICAL || (type === QuestionType.MIX && (!enabledTypes || enabledTypes.includes(QuestionType.PRACTICAL)));
  
  for (const file of files) {
    if (file.type === "application/pdf") {
      combinedText += `\n--- START OF PDF: ${file.name} ---\n`;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let pdfText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          pdfText += pageText + "\n";
          
          // If practical, render pages as images (limit to reasonable number)
          if (isPractical && i <= 15) {
            const viewport = page.getViewport({ scale: 2.0 }); // Higher resolution
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context!, viewport }).promise;
            
            // Aggressive Text Redaction for Practical Exams (and Mixed exams with practical parts)
            if (isPractical) {
                // White out top and bottom common header/footer zones first
                context!.fillStyle = "white";
                context!.fillRect(0, 0, canvas.width, canvas.height * 0.15); // Top 15%
                context!.fillRect(0, canvas.height * 0.88, canvas.width, canvas.height * 0.12); // Bottom 12%

                // Optional: For even more precision, white out individual text items
                // Note: We use the already fetched textContent
                textContent.items.forEach((item: any) => {
                  if (item.str && item.str.trim().length > 0) {
                    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                    // Simplify: white out a box around the text
                    // item.width and height are in PDF units, need scaling
                    const width = item.width * viewport.scale;
                    const height = item.height * viewport.scale || 15 * viewport.scale; // Fallback height
                    
                    // The transform gives us the baseline. PDF coordinates are Y-up.
                    // viewport.transform maps PDF to Canvas.
                    context!.fillStyle = "white";
                    // Add some padding to redaction
                    context!.fillRect(tx[4] - 5, tx[5] - height - 5, width + 10, height + 10);
                  }
                });
            }
            
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            images.push({
              inlineData: {
                data: base64.split(',')[1],
                mimeType: 'image/jpeg'
              }
            });
          }
        }
        combinedText += pdfText;
      } catch (e) {
        console.error("PDF Error:", file.name, e);
      }
      combinedText += `\n--- END OF PDF: ${file.name} ---\n`;
    } else if (file.type.startsWith("image/")) {
      try {
        const base64 = await fileToBase64(file);
        images.push({
          inlineData: {
            data: base64.split(',')[1],
            mimeType: file.type
          }
        });
      } catch (e) {
        console.error("Image Error:", file.name, e);
      }
    } else {
      combinedText += `\n--- START OF FILE: ${file.name} ---\n`;
      const text = await file.text();
      combinedText += text + "\n";
      combinedText += `\n--- END OF FILE: ${file.name} ---\n`;
    }
  }
  return { text: combinedText.trim(), images };
};

const extractTextFromFiles = async (files: File[]): Promise<string> => {
  const result = await processFilesForGemini(files, QuestionType.MCQ);
  return result.text;
};

/** --- Components --- */

const Navbar = ({ lang, setLang, user }: { lang: 'en' | 'ar', setLang: any, user: any }) => {
  const strings = TRANSLATIONS[lang];
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleOpenKeySelector = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
    } else {
      alert("خاصية اختيار المفتاح غير متوفرة في هذا المتصفح.");
    }
  };

  const handleClearCache = () => {
    if (confirm(strings.clearCache + "?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleExportData = () => {
    const data = {
      quizzes: JSON.parse(localStorage.getItem('mq_quizzes_v5') || '[]'),
      attempts: JSON.parse(localStorage.getItem('mq_attempts_v5') || '[]'),
      subjects: JSON.parse(localStorage.getItem('mq_subjects_v5') || '[]'),
      version: 'v5'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medicine_quiz_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.quizzes && Array.isArray(data.quizzes)) {
          localStorage.setItem('mq_quizzes_v5', JSON.stringify(data.quizzes));
          localStorage.setItem('mq_attempts_v5', JSON.stringify(data.attempts || []));
          localStorage.setItem('mq_subjects_v5', JSON.stringify(data.subjects || []));
          alert("تم استيراد البيانات بنجاح! سيتم إعادة تحميل الصفحة.");
          window.location.reload();
        } else {
          alert("ملف غير صالح!");
        }
      } catch (err) {
        alert("خطأ في قراءة الملف!");
      }
    };
    reader.readAsText(file);
  };

  return (
    <nav className={`bg-white/80 backdrop-blur-md border-b sticky top-0 z-50 px-4 md:px-8 py-3 flex justify-between items-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="flex items-center gap-4">
        {!isHome && (
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-indigo-600 font-bold">
            {lang === 'ar' ? '→' : '←'} {strings.back}
          </button>
        )}
        <h1 onClick={() => navigate('/')} className="text-xl md:text-2xl font-black text-indigo-600 cursor-pointer flex items-center gap-2">
          <span className="text-3xl">✨</span> <span className="hidden sm:inline">{strings.title}</span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 border-r pr-3 mr-1">
          <button onClick={handleExportData} title={strings.exportData} className="p-2 text-slate-500 hover:text-indigo-600 transition-colors text-xs font-bold flex items-center gap-1">
            📤 {strings.exportData}
          </button>
          <label className="p-2 text-slate-500 hover:text-indigo-600 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer">
            📥 {strings.importData}
            <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
          </label>
        </div>
        <button 
          onClick={handleClearCache}
          title={strings.clearCache}
          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
        >
          🗑️ <span className="hidden lg:inline">{strings.clearCache}</span>
        </button>
        <button onClick={() => navigate('/stats')} className="p-2 text-slate-500 hover:text-indigo-600 font-bold text-sm flex items-center gap-1">
          📊 <span className="hidden sm:inline">{strings.stats}</span>
        </button>
        <button 
          onClick={handleOpenKeySelector}
          title="إعداد مفتاح API"
          className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors flex items-center gap-2 text-xs font-bold"
        >
          🔑 <span className="hidden md:inline">مفتاح API</span>
        </button>
        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="text-xs font-bold text-slate-500 hover:text-indigo-600 border px-3 py-1 rounded-full">
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>
    </nav>
  );
};

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow ${className}`}>
    {children}
  </div>
);

/** --- Stats View --- */
const StatsDashboard = ({ attempts, quizzes, strings, lang }: any) => {
  const metrics = useMemo(() => {
    if (!attempts.length) return null;
    const avgScore = (attempts.reduce((acc: number, curr: any) => acc + (curr.score / curr.totalQuestions), 0) / attempts.length) * 100;
    const totalTime = attempts.reduce((acc: number, curr: any) => acc + (curr.timeSpent || 0), 0);
    return {
      total: attempts.length,
      avg: Math.round(avgScore),
      time: totalTime
    };
  }, [attempts]);

  const timelineData = useMemo(() => {
    return attempts.slice(-10).map((a: any, i: number) => ({
      name: `T-${10-i}`,
      score: Math.round((a.score / a.totalQuestions) * 100),
      date: new Date(a.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')
    }));
  }, [attempts, lang]);

  const difficultyData = useMemo(() => {
    const diffs = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.VERY_HARD];
    return diffs.map(d => {
      const relevant = attempts.filter((a: any) => {
        const q = quizzes.find((qz: any) => qz.id === a.quizId);
        return q?.difficulty === d;
      });
      const avg = relevant.length ? (relevant.reduce((acc: number, curr: any) => acc + (curr.score / curr.totalQuestions), 0) / relevant.length) * 100 : 0;
      return {
        name: strings[d as keyof typeof strings] || d,
        score: Math.round(avg)
      };
    });
  }, [attempts, quizzes, strings]);

  if (!attempts.length) {
    return (
      <div className="text-center py-32 space-y-6">
        <div className="text-8xl opacity-20">📊</div>
        <h2 className="text-2xl font-black text-slate-400">لا توجد بيانات كافية لعرض الإحصائيات</h2>
        <p className="text-slate-400">ابدأ بإنهاء اختبارك الأول لرؤية تحليلات أدائك!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white border-none shadow-indigo-200">
          <p className="text-indigo-100 font-black text-xs uppercase tracking-widest mb-2">{strings.score}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black">{metrics?.avg}%</span>
            <span className="text-sm font-bold opacity-70">متوسط الأداء</span>
          </div>
        </Card>
        <Card className="bg-white border-slate-100">
          <p className="text-slate-400 font-black text-xs uppercase tracking-widest mb-2">إجمالي المحاولات</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-slate-800">{metrics?.total}</span>
            <span className="text-sm font-bold text-slate-400">اختبار</span>
          </div>
        </Card>
        <Card className="bg-white border-slate-100">
          <p className="text-slate-400 font-black text-xs uppercase tracking-widest mb-2">الوقت الكلي</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-slate-800">{metrics?.time}</span>
            <span className="text-sm font-bold text-slate-400">دقيقة</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="!p-8">
          <h3 className="text-lg font-black mb-8 flex items-center gap-2">📈 اتجاه تطور المستوى (آخر 10)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#94a3b8'}} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelStyle={{ fontWeight: 900, marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="!p-8">
          <h3 className="text-lg font-black mb-8 flex items-center gap-2">📊 الأداء حسب مستوى الصعوبة</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 12, fontWeight: 800, fill: '#64748b'}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={20}>
                  {difficultyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444'][index % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

/** --- Views --- */

const Dashboard = ({ strings, quizzes, setQuizzes, subjects, setSubjects, lang }: any) => {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const handleShare = (e: React.MouseEvent, quiz: Quiz) => {
    e.stopPropagation();
    const code = encodeQuiz(quiz);
    const url = `${window.location.origin}/import?data=${code}`;
    
    if (url.length > 2000) {
      navigator.clipboard.writeText(code);
      alert("الاختبار كبير جداً للرابط، تم نسخ 'كود الاختبار' بدلاً من ذلك. يمكن لزميلك استخدامه عبر زر 'استيراد اختبار'!");
    } else {
      navigator.clipboard.writeText(url);
      alert(strings.copySuccess);
    }
  };

  const handleCopyCode = (e: React.MouseEvent, quiz: Quiz) => {
    e.stopPropagation();
    const code = encodeQuiz(quiz);
    navigator.clipboard.writeText(code);
    alert("تم نسخ كود الاختبار! يمكنك إرساله لزملائك لاستخدامه في زر الاستيراد.");
  };

  const handleDelete = (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    if (confirm(strings.delete + "?")) {
      setQuizzes((prev: Quiz[]) => prev.filter((q: Quiz) => q.id !== quizId));
    }
  };

  const startEditing = (e: React.MouseEvent, quiz: Quiz) => {
    e.stopPropagation();
    setEditingId(quiz.id);
    setEditValue(quiz.title);
  };

  const saveRename = () => {
    if (editingId && editValue.trim()) {
      setQuizzes((prev: Quiz[]) => prev.map((q: Quiz) => q.id === editingId ? { ...q, title: editValue.trim() } : q));
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') setEditingId(null);
  };

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const handleAddSubject = () => {
    if (newSubjectName.trim()) {
      const newSubject: Subject = { id: Math.random().toString(36).substr(2, 9), name: newSubjectName.trim(), chapters: [] };
      setSubjects([...subjects, newSubject]);
      setNewSubjectName("");
      setIsAddingSubject(false);
    }
  };

  const handleAddSubjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddSubject();
    if (e.key === 'Escape') {
      setIsAddingSubject(false);
      setNewSubjectName("");
    }
  };

  const handleDeleteSubject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(strings.delete + "?")) {
      setSubjects(subjects.filter((s: Subject) => s.id !== id));
      setQuizzes(quizzes.map((q: Quiz) => q.subjectId === id ? { ...q, subjectId: '' } : q));
      if (selectedSubjectId === id) setSelectedSubjectId(null);
    }
  };

  const handleMoveQuiz = (e: React.ChangeEvent<HTMLSelectElement>, quizId: string) => {
    const subjectId = e.target.value;
    setQuizzes((prev: Quiz[]) => prev.map((q: Quiz) => q.id === quizId ? { ...q, subjectId } : q));
  };

  const groupedQuizzes = useMemo(() => {
    const groups: Record<string, Quiz[]> = { '': [] };
    subjects.forEach((s: Subject) => { groups[s.id] = []; });
    quizzes.forEach((q: Quiz) => {
      if (groups[q.subjectId]) groups[q.subjectId].push(q);
      else groups[''].push(q);
    });
    return groups;
  }, [quizzes, subjects]);

  const handleManualImport = () => {
    const code = prompt(strings.importQuiz);
    if (code) {
      const decoded = decodeQuiz(code);
      if (decoded) {
        if (!quizzes.find((q: Quiz) => q.id === decoded.id)) {
          setQuizzes((prev: Quiz[]) => [...prev, { ...decoded, subjectId: decoded.subjectId || '' }]);
          alert("تم استيراد الاختبار بنجاح!");
        } else {
          alert("هذا الاختبار موجود بالفعل!");
        }
      } else {
        alert("الكود غير صالح!");
      }
    }
  };

  const currentSubject = selectedSubjectId === '' 
    ? { id: '', name: strings.uncategorized } 
    : subjects.find((s: any) => s.id === selectedSubjectId);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Card className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white relative overflow-hidden group">
        <div className="relative z-10 p-4">
          <h2 className="text-3xl font-black mb-2">Welcome Dr Hady ✨</h2>
          <p className="text-indigo-100 font-bold mb-8">أهلاً بك في كويز برو! حول ملفاتك الدراسية إلى اختبارات ذكية فوراً.</p>
          <div className="flex gap-4">
            <button onClick={() => navigate('/create')} className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all">بدء توليد جديد ✨</button>
            <button onClick={() => navigate('/stats')} className="px-6 py-5 bg-indigo-500/30 text-white border border-white/20 rounded-2xl font-black hover:bg-indigo-500/50 transition-all">النتائج 📊</button>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 text-9xl opacity-20 group-hover:rotate-12 transition-transform">🎓</div>
      </Card>

      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
          {selectedSubjectId !== null && (
            <button onClick={() => setSelectedSubjectId(null)} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-indigo-600 font-black">
              {lang === 'ar' ? '→' : '←'}
            </button>
          )}
          <h3 className="text-xl font-black flex items-center gap-2">
            {selectedSubjectId === null ? `📂 ${strings.subjects}` : `📂 ${currentSubject?.name}`}
          </h3>
        </div>
        <div className="flex gap-2">
          <button onClick={handleManualImport} className="px-4 py-2 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-50 transition-all flex items-center gap-2">
            📥 {strings.importQuiz}
          </button>
          {isAddingSubject ? (
            <div className="flex gap-2 animate-in slide-in-from-right-2 duration-300">
              <input 
                autoFocus
                className="px-4 py-2 bg-white border-2 border-indigo-500 rounded-xl font-bold outline-none text-sm"
                placeholder={strings.categoryName}
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={handleAddSubjectKeyDown}
                onBlur={() => { if(!newSubjectName.trim()) setIsAddingSubject(false); }}
              />
              <button onClick={handleAddSubject} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all">✅</button>
              <button onClick={() => { setIsAddingSubject(false); setNewSubjectName(""); }} className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-all">❌</button>
            </div>
          ) : (
            <button onClick={() => setIsAddingSubject(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all flex items-center gap-2">
              <span>➕</span> {strings.addCategory}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-12 min-h-[400px]">
        {quizzes.length === 0 && subjects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-slate-400 font-black text-xl italic">لا توجد اختبارات.. ارفع ملفاً للبدء!</p>
          </div>
        ) : selectedSubjectId === null ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in zoom-in-95 duration-300">
            {[...subjects, { id: '', name: strings.uncategorized }].map((s: any) => {
              const count = groupedQuizzes[s.id]?.length || 0;
              if (s.id === '' && count === 0) return null;
              return (
                <div 
                  key={s.id} 
                  onClick={() => setSelectedSubjectId(s.id)}
                  className="group cursor-pointer bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden"
                >
                  <div className="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:opacity-10 transition-opacity">📂</div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {s.id === '' ? '📦' : '📁'}
                    </div>
                    <h4 className="font-black text-slate-800 text-lg mb-1 truncate">{s.name}</h4>
                    <p className="text-slate-400 font-bold text-xs">{count} {strings.questionCount}</p>
                  </div>
                  {s.id !== '' && (
                    <button 
                      onClick={(e) => handleDeleteSubject(e, s.id)} 
                      className="absolute bottom-6 left-6 p-2 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            {groupedQuizzes[selectedSubjectId]?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedQuizzes[selectedSubjectId].map((q: Quiz) => (
                  <div key={q.id} className="p-5 border rounded-3xl bg-white shadow-sm hover:shadow-lg transition-all border-slate-100 group relative">
                    <div className="absolute top-4 left-4 flex gap-2 z-20 opacity-0 group-hover:opacity-100 md:opacity-0 transition-opacity">
                      <button onClick={(e) => handleDelete(e, q.id)} className="p-2 bg-white rounded-xl shadow-sm text-rose-600 hover:bg-rose-50" title={strings.delete}>🗑️</button>
                      <button onClick={(e) => startEditing(e, q)} className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 hover:bg-indigo-50" title={strings.rename}>✏️</button>
                      <button onClick={(e) => handleCopyCode(e, q)} className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 hover:bg-indigo-50" title="نسخ الكود">📄</button>
                      <button onClick={(e) => handleShare(e, q)} className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 hover:bg-indigo-50" title={strings.share}>🔗</button>
                    </div>
                    
                    <div className="md:hidden absolute top-4 left-4 z-20">
                       <div className="flex gap-1">
                         <button onClick={(e) => handleDelete(e, q.id)} className="p-1.5 bg-white/80 rounded-lg text-rose-600 text-xs">🗑️</button>
                         <button onClick={(e) => startEditing(e, q)} className="p-1.5 bg-white/80 rounded-lg text-indigo-600 text-xs">✏️</button>
                         <button onClick={(e) => handleCopyCode(e, q)} className="p-1.5 bg-white/80 rounded-lg text-indigo-600 text-xs">📄</button>
                       </div>
                    </div>

                    <div className="mb-4">
                       <div className="flex justify-between items-start gap-2">
                         <span className="text-[10px] font-black uppercase px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 flex-shrink-0">{strings[q.difficulty as keyof typeof strings]}</span>
                         <div className="flex flex-col items-end gap-1 flex-1 min-w-0">
                           <span className="text-[9px] font-bold text-slate-400 uppercase">نقل إلى:</span>
                           <select 
                             value={q.subjectId || ""} 
                             onChange={(e) => handleMoveQuiz(e, q.id)}
                             onClick={(e) => e.stopPropagation()}
                             className="w-full text-[10px] font-black bg-white border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                           >
                             <option value="">{strings.uncategorized}</option>
                             {subjects.map((s: Subject) => (
                               <option key={s.id} value={s.id}>{s.name}</option>
                             ))}
                           </select>
                         </div>
                       </div>
                       {editingId === q.id ? (
                         <input 
                           autoFocus
                           className="w-full mt-2 p-2 border-2 border-indigo-500 rounded-xl font-bold outline-none"
                           value={editValue}
                           onChange={(e) => setEditValue(e.target.value)}
                           onBlur={saveRename}
                           onKeyDown={handleKeyDown}
                           onClick={(e) => e.stopPropagation()}
                         />
                       ) : (
                         <h4 className="font-black text-slate-800 mt-2 line-clamp-1">{q.title}</h4>
                       )}
                    </div>
                    <button onClick={() => navigate(`/quiz/${q.id}`)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-colors">ابدأ الآن</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <div className="text-6xl mb-4">📂</div>
                <p className="text-slate-400 font-black text-xl italic">هذا القسم فارغ حالياً</p>
                <button onClick={() => setSelectedSubjectId(null)} className="mt-4 text-indigo-600 font-black hover:underline">العودة للأقسام</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CreateQuiz = ({ strings, quizzes, setQuizzes, subjects }: any) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [diff, setDiff] = useState(Difficulty.MEDIUM);
  const [type, setType] = useState(QuestionType.MIX);
  const [count, setCount] = useState(10);
  const [customTitle, setCustomTitle] = useState("");
  const [passingScore, setPassingScore] = useState(60);
  const [mcqRatio, setMcqRatio] = useState(50);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [enabledTypes, setEnabledTypes] = useState<QuestionType[]>([
    QuestionType.MCQ,
    QuestionType.TRUE_FALSE,
    QuestionType.MULTIPLE_SELECT,
    QuestionType.SHORT_ANSWER,
    QuestionType.PRACTICAL
  ]);

  const handleGenerate = async () => {
    if (!files.length) return alert("الرجاء رفع ملف أولاً");
    if (type === QuestionType.MIX && enabledTypes.length === 0) {
      return alert("يرجى تحديد نوع واحد على الأقل للمزيج.");
    }

    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        alert("يرجى اختيار مفتاح API أولاً.");
        await window.aistudio.openSelectKey();
      }
    }
    
    setLoading(true);
    setLoadingStatus("جاري استخراج النص والصور...");
    
    try {
      const { text, images } = await processFilesForGemini(files, type, enabledTypes);
      if (!text && !images.length) throw new Error("لم نتمكن من الحصول على أي محتوى من الملفات المرفقة.");
      
      setLoadingStatus("الذكاء الاصطناعي يقوم بالتوليد...");
      const questions = await generateQuizQuestions(text, images, count, type, diff, 'original', mcqRatio, enabledTypes);
      
      const newQuiz: Quiz = {
        id: Math.random().toString(36).substr(2, 9),
        title: customTitle.trim() || files[0]?.name.split('.')[0] || "اختبار ذكي",
        subjectId: selectedSubject, chapterId: '', difficulty: diff, questions, 
        passingScore: passingScore,
        createdAt: Date.now()
      };
      
      setQuizzes([...quizzes, newQuiz]);
      navigate(`/quiz/${newQuiz.id}`);
    } catch (e: any) {
      if (e.message.includes("API Key must be set") || e.message === "API_KEY_ERROR") {
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        alert(e.message || "حدث خطأ غير متوقع.");
      }
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in zoom-in duration-500">
      <Card className="p-8 md:p-12 !rounded-[3rem] shadow-2xl border-t-8 border-indigo-600">
        <h2 className="text-3xl font-black text-center mb-10 text-slate-800">توليد اختبار ذكي 🤖</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="border-4 border-dashed border-slate-100 rounded-3xl p-10 text-center bg-slate-50 hover:bg-white hover:border-indigo-200 transition-all cursor-pointer relative group">
              <input type="file" multiple accept=".pdf,.txt,.jpg,.jpeg,.png" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
                const newFiles = Array.from(e.target.files || []);
                setFiles(newFiles);
                if (newFiles.length > 0 && !customTitle) {
                  setCustomTitle(newFiles[0].name.split('.')[0]);
                }
              }} />
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📄</div>
              <p className="font-black text-slate-600">{files.length > 0 ? `${files.length} ملفات جاهزة (بما في ذلك الصور)` : strings.uploadFiles}</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {files.filter(f => f.type.startsWith('image/')).map((f, i) => (
                <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-sm relative">
                  <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="preview" />
                </div>
              ))}
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase">{strings.quizTitle}</label>
              <input 
                type="text" 
                placeholder={strings.quizTitle}
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase">{strings.subjects}</label>
              <select 
                value={selectedSubject} 
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">{strings.uncategorized}</option>
                {subjects.map((s: Subject) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase">مستوى الصعوبة</label>
              <div className="grid grid-cols-2 gap-2">
                {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.VERY_HARD].map(d => (
                  <button key={d} onClick={() => setDiff(d)} className={`py-3 rounded-xl font-bold text-[10px] transition-all ${diff === d ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                    {strings[d as keyof typeof strings] || d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">{strings.questionCount}</label>
                <input type="number" value={count} onChange={e => setCount(Math.max(1, Number(e.target.value)))} className="w-full p-3 bg-slate-50 rounded-xl font-black text-center border-none outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">{strings.passingScore}</label>
                <input type="number" value={passingScore} onChange={e => setPassingScore(Math.min(100, Math.max(0, Number(e.target.value))))} className="w-full p-3 bg-slate-50 rounded-xl font-black text-center border-none outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">نوع الأسئلة</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-3 bg-slate-50 rounded-xl font-black text-xs border-none outline-none">
                  <option value={QuestionType.MCQ}>{strings.mcq}</option>
                  <option value={QuestionType.TRUE_FALSE}>{strings.tf}</option>
                  <option value={QuestionType.MULTIPLE_SELECT}>{strings.multipleSelect}</option>
                  <option value={QuestionType.SHORT_ANSWER}>{strings.shortAnswer}</option>
                  <option value={QuestionType.PRACTICAL}>{strings.practical}</option>
                  <option value={QuestionType.MIX}>{strings.mix}</option>
                </select>
              </div>

              {type === QuestionType.MIX && (
                <div className="space-y-4 p-5 bg-indigo-50/40 rounded-3xl border border-indigo-100/60 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-500 uppercase">الأسئلة المطلوبة في المزيج:</label>
                    <button 
                      type="button" 
                      onClick={() => setEnabledTypes([QuestionType.MCQ, QuestionType.TRUE_FALSE, QuestionType.MULTIPLE_SELECT, QuestionType.SHORT_ANSWER, QuestionType.PRACTICAL])}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      تحديد الكل
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { val: QuestionType.MCQ, label: strings.mcq, icon: "🎯" },
                      { val: QuestionType.TRUE_FALSE, label: strings.tf, icon: "⚖️" },
                      { val: QuestionType.MULTIPLE_SELECT, label: strings.multipleSelect, icon: "☑️" },
                      { val: QuestionType.SHORT_ANSWER, label: strings.shortAnswer, icon: "⌨️" },
                      { val: QuestionType.PRACTICAL, label: strings.practical, icon: "🔬" },
                    ].map(opt => {
                      const active = enabledTypes.includes(opt.val);
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => {
                            if (active) {
                              setEnabledTypes(enabledTypes.filter(t => t !== opt.val));
                            } else {
                              setEnabledTypes([...enabledTypes, opt.val]);
                            }
                          }}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 text-right transition-all font-black text-sm ${active ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{opt.icon}</span>
                            <span>{opt.label}</span>
                          </div>
                          <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[11px] ${active ? 'bg-indigo-600 text-white' : 'border-2 border-slate-200'}`}>
                            {active ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  
                  {enabledTypes.includes(QuestionType.MCQ) && enabledTypes.includes(QuestionType.TRUE_FALSE) && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 animate-in fade-in duration-300">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-400 uppercase">{strings.mcqRatio}</label>
                        <span className="text-xs font-black text-indigo-600">{mcqRatio}% MCQ</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="10"
                        value={mcqRatio} 
                        onChange={e => setMcqRatio(Number(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>{strings.tf}</span>
                        <span>{strings.mcq}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={loading || files.length === 0} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex flex-col items-center justify-center">
          {loading ? <span className="animate-pulse">{loadingStatus}</span> : "توليد الأسئلة الآن ✨"}
        </button>
      </Card>
    </div>
  );
};

const QuizInterface = ({ strings, setAttempts, quizzes, user }: any) => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [cur, setCur] = useState(0);
  const [ans, setAns] = useState<any>({});
  const [showExpl, setShowExpl] = useState(false);
  const [showRes, setShowRes] = useState(false);
  const [start] = useState(Date.now());

  const quiz = useMemo(() => quizzes.find((q: any) => q.id === quizId), [quizId, quizzes]);
  const [typingModes, setTypingModes] = useState<Record<string, boolean>>({});

  if (!quiz) return <div className="text-center py-20 font-black text-slate-300 italic">الاختبار غير موجود..</div>;

  const current = quiz.questions[cur];
  const progress = ((cur + 1) / quiz.questions.length) * 100;
  const isTyping = current.type === QuestionType.SHORT_ANSWER && typingModes[current.id] !== false;

  const handleShare = () => {
    const code = encodeQuiz(quiz);
    const url = `${window.location.origin}${window.location.pathname}#/import?data=${code}`;
    navigator.clipboard.writeText(url);
    alert(strings.copySuccess);
  };

  const isCorrect = (q: any, studentAnswer: any) => {
    if (!studentAnswer) return false;
    const correct = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
    const student = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
    
    if (q.type === QuestionType.SHORT_ANSWER) {
      // For short answer, any of the correct answers can match
      const studentStr = String(student[0] || '').trim().toLowerCase();
      return correct.some((c: any) => String(c).trim().toLowerCase() === studentStr);
    }

    if (correct.length !== student.length) return false;
    return correct.every((c: any) => student.includes(c));
  };

  const onAnswer = (opt: string) => {
    if (showExpl) return;
    
    if (current.type === QuestionType.MULTIPLE_SELECT) {
      const currentAns = Array.isArray(ans[current.id]) ? [...ans[current.id]] : [];
      if (currentAns.includes(opt)) {
        setAns({...ans, [current.id]: currentAns.filter(a => a !== opt)});
      } else {
        setAns({...ans, [current.id]: [...currentAns, opt]});
      }
    } else {
      setAns({...ans, [current.id]: opt});
      setShowExpl(true);
    }
  };

  const onNext = () => {
    setShowExpl(false);
    if (cur < quiz.questions.length - 1) setCur(cur + 1);
    else {
      const score = quiz.questions.reduce((a: number, q: any) => a + (isCorrect(q, ans[q.id]) ? 1 : 0), 0);
      const attempt: QuizAttempt = {
        id: Date.now().toString(), quizId: quiz.id, userId: user.id, userName: user.name,
        score, totalQuestions: quiz.questions.length, timeSpent: Math.round((Date.now() - start)/60000), date: Date.now()
      };
      setAttempts((p: any) => [...p, attempt]);
      setShowRes(true);
    }
  };

  if (showRes) {
    const score = quiz.questions.reduce((a: number, q: any) => a + (isCorrect(q, ans[q.id]) ? 1 : 0), 0);
    const percentage = Math.round((score / quiz.questions.length) * 100);
    const isPassed = percentage >= (quiz.passingScore || 60);

    return (
      <div className="max-w-3xl mx-auto animate-in zoom-in duration-500">
        <Card className={`text-center p-12 !rounded-[4rem] border-t-8 shadow-2xl ${isPassed ? 'border-emerald-500' : 'border-rose-500'}`}>
          <div className="text-7xl mb-6">{isPassed ? '🎉' : '💔'}</div>
          <h2 className="text-4xl font-black mb-2 text-slate-800">{strings.results}</h2>
          <p className={`text-2xl font-black mb-8 ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPassed ? strings.pass : strings.fail} ({percentage}%)
          </p>
          
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="p-6 bg-slate-50 rounded-3xl"><p className="text-5xl font-black text-indigo-600">{score}/{quiz.questions.length}</p><p className="text-slate-400 font-bold text-xs mt-2">النتيجة</p></div>
            <div className="p-6 bg-slate-50 rounded-3xl"><p className="text-5xl font-black text-indigo-600">{Math.round((Date.now()-start)/1000)}ث</p><p className="text-slate-400 font-bold text-xs mt-2">الوقت</p></div>
          </div>
          
          <div className="space-y-4">
            <button onClick={handleShare} className="w-full py-5 bg-amber-50 text-amber-600 rounded-2xl font-black text-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-3">
              <span>🔗</span> {strings.share}
            </button>
            <button onClick={() => navigate('/stats')} className="w-full py-5 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xl hover:bg-indigo-100 transition-all">عرض الإحصائيات 📊</button>
            <button onClick={() => navigate('/')} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all">
              {strings.home}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8 sticky top-20 z-40 bg-slate-50/90 backdrop-blur-md py-4 px-2">
        <div className="flex justify-between items-center font-black text-xs text-indigo-600 mb-2 px-2">
          <span>سؤال {cur+1} / {quiz.questions.length}</span>
          <span className="bg-indigo-100 px-3 py-1 rounded-full uppercase">{strings[quiz.difficulty as keyof typeof strings]}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-white rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-indigo-600 transition-all duration-500" style={{width: `${progress}%`}} />
        </div>
      </div>
      <Card className="p-8 md:p-12 !rounded-[3rem] shadow-xl">
        {current.imageUrl && (
          <div className="mb-8 rounded-3xl overflow-hidden border-4 border-slate-100 shadow-lg group relative">
            <img src={current.imageUrl} className="w-full max-h-[400px] object-contain bg-slate-50" alt="Question visual context" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all pointer-events-none" />
          </div>
        )}

        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl md:text-2xl font-black text-slate-800 leading-snug">{current.text}</h3>
        </div>

        {(current.type === QuestionType.MULTIPLE_SELECT || current.type === QuestionType.SHORT_ANSWER) && (
          <div className="mb-6 flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase">
              {current.type === QuestionType.MULTIPLE_SELECT ? strings.multipleSelect : strings.shortAnswer}
            </span>
            {current.type === QuestionType.MULTIPLE_SELECT && (
              <span className="text-[10px] font-bold text-slate-400 italic">
                ({Array.isArray(current.correctAnswer) ? current.correctAnswer.length : 1} {strings.selectRequired})
              </span>
            )}
          </div>
        )}

        {isTyping ? (
          <div className="space-y-4">
            <input 
              type="text" 
              disabled={showExpl}
              value={ans[current.id] || ""} 
              onChange={e => setAns({...ans, [current.id]: e.target.value})}
              placeholder={strings.writeAnswer}
              className="w-full p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 font-black text-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
            />
            {!showExpl && (
              <button 
                onClick={() => setTypingModes({...typingModes, [current.id]: false})}
                className="text-indigo-600 font-black text-xs hover:underline flex items-center gap-1 px-4"
              >
                🖱️ {strings.switchToMCQ}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(current.options || []).map((opt: string, i: number) => {
                 const isSel = current.type === QuestionType.MULTIPLE_SELECT 
                    ? (Array.isArray(ans[current.id]) && ans[current.id].includes(opt))
                    : ans[current.id] === opt;
                 
                 const isCorr = Array.isArray(current.correctAnswer) 
                    ? current.correctAnswer.includes(opt)
                    : opt === current.correctAnswer;
    
                 let style = "border-slate-100 text-slate-600 hover:bg-slate-50";
                 if (showExpl) {
                   if (isCorr) style = "bg-emerald-500 border-emerald-500 text-white shadow-lg";
                   else if (isSel) style = "bg-rose-500 border-rose-500 text-white shadow-lg";
                   else style = "opacity-40 grayscale pointer-events-none";
                 } else if (isSel) style = "bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]";
                 
                 return (
                   <button key={i} onClick={() => onAnswer(opt)} className={`p-6 rounded-3xl border-2 font-black transition-all text-right flex items-center gap-4 ${style}`}>
                     <span className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center font-black ${isSel || (showExpl && isCorr) ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                       {String.fromCharCode(65+i)}
                     </span>
                     <span className="text-sm md:text-base">{opt}</span>
                   </button>
                 );
              })}
            </div>
            {current.type === QuestionType.SHORT_ANSWER && !showExpl && (
              <button 
                onClick={() => setTypingModes({...typingModes, [current.id]: true})}
                className="text-indigo-600 font-black text-xs hover:underline flex items-center gap-1 px-4"
              >
                ⌨️ {strings.switchToType}
              </button>
            )}
          </div>
        )}
        {showExpl && (
          <div className="mt-8 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
              <h4 className="font-black text-emerald-800 mb-2 flex items-center gap-2">✅ {strings.modelAnswer}:</h4>
              <p className="text-emerald-900 font-bold">
                {Array.isArray(current.correctAnswer) ? current.correctAnswer.join(" | ") : current.correctAnswer}
              </p>
            </div>
            <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
              <h4 className="font-black text-indigo-800 mb-2 flex items-center gap-2">💡 {strings.explanation}:</h4>
              <p className="text-indigo-900/70 font-bold leading-relaxed">{current.explanation}</p>
            </div>
          </div>
        )}
        <div className="mt-16 flex justify-between items-center border-t pt-8">
          <button onClick={() => navigate('/')} className="text-slate-400 font-bold hover:text-rose-500 transition-colors text-xs">إلغاء الاختبار</button>
          
          <div className="flex gap-4">
            {(current.type === QuestionType.MULTIPLE_SELECT || current.type === QuestionType.SHORT_ANSWER) && !showExpl && (
              <button 
                onClick={() => setShowExpl(true)} 
                disabled={!ans[current.id] || (Array.isArray(ans[current.id]) ? ans[current.id].length === 0 : !ans[current.id].trim())}
                className="px-8 py-4 bg-amber-500 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-amber-600 disabled:opacity-20 transition-all font-sans"
              >
                {strings.checkAnswer}
              </button>
            )}

            <button onClick={onNext} disabled={!ans[current.id] || ((current.type === QuestionType.MULTIPLE_SELECT || current.type === QuestionType.SHORT_ANSWER) && !showExpl)} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-black disabled:opacity-20 transition-all flex items-center gap-2">
              {cur === quiz.questions.length - 1 ? strings.finish : strings.next}
              <span>➜</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const ImportQuiz = ({ quizzes, setQuizzes }: any) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const data = params.get('data');
    if (data) {
      const decoded = decodeQuiz(data);
      if (decoded) {
        if (!quizzes.find((q: any) => q.id === decoded.id)) {
          setQuizzes((prev: any) => [...prev, { ...decoded, subjectId: decoded.subjectId || '' }]);
        }
        // Clear the URL parameters after import to prevent re-importing on refresh
        navigate(`/quiz/${decoded.id}`, { replace: true });
      } else {
        alert("الرابط تالف أو غير صالح!");
        navigate('/', { replace: true });
      }
    }
  }, [location, navigate, quizzes, setQuizzes]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <h2 className="text-2xl font-black text-indigo-600 animate-pulse">جاري استيراد الاختبار المشترك...</h2>
      <p className="text-slate-400 font-bold text-sm">سيتم توجيهك إلى الاختبار فوراً</p>
    </div>
  );
};

/** --- Main App --- */

const App = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [user] = useState({ id: 'anon', name: 'مستخدم مجهول', photo: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', isLoggedIn: true });
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const q = localStorage.getItem('mq_quizzes_v5');
    if (!q) return [];
    try {
      const parsed = JSON.parse(q);
      return parsed.map((quiz: any) => ({
        ...quiz,
        subjectId: quiz.subjectId || ''
      }));
    } catch (e) {
      return [];
    }
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    const a = localStorage.getItem('mq_attempts_v5');
    return a ? JSON.parse(a) : [];
  });
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const s = localStorage.getItem('mq_subjects_v5');
    return s ? JSON.parse(s) : [];
  });

  useEffect(() => localStorage.setItem('mq_quizzes_v5', JSON.stringify(quizzes)), [quizzes]);
  useEffect(() => localStorage.setItem('mq_attempts_v5', JSON.stringify(attempts)), [attempts]);
  useEffect(() => localStorage.setItem('mq_subjects_v5', JSON.stringify(subjects)), [subjects]);

  return (
    <Router>
      <div className={`min-h-screen bg-slate-50 pb-20 overflow-x-hidden ${lang === 'ar' ? 'rtl' : ''}`}>
        <Navbar lang={lang} setLang={setLang} user={user} />
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard strings={TRANSLATIONS[lang]} attempts={attempts} quizzes={quizzes} setQuizzes={setQuizzes} subjects={subjects} setSubjects={setSubjects} lang={lang} user={user} />} />
            <Route path="/create" element={<CreateQuiz strings={TRANSLATIONS[lang]} quizzes={quizzes} setQuizzes={setQuizzes} subjects={subjects} />} />
            <Route path="/quiz/:quizId" element={<QuizInterface strings={TRANSLATIONS[lang]} setAttempts={setAttempts} quizzes={quizzes} user={user} />} />
            <Route path="/stats" element={<StatsDashboard attempts={attempts} quizzes={quizzes} strings={TRANSLATIONS[lang]} lang={lang} />} />
            <Route path="/import" element={<ImportQuiz quizzes={quizzes} setQuizzes={setQuizzes} />} />
            <Route path="*" element={<div className="text-center py-20 font-black">الصفحة غير موجودة!</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
