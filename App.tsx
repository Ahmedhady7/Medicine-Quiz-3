
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell 
} from 'recharts';
import { 
  Subject, Chapter, Difficulty, QuestionType, Question, Quiz, QuizAttempt, LanguageStrings 
} from './types';
import { TRANSLATIONS } from './constants';
import { generateMedicalQuestions } from './services/geminiService';

// --- Components ---

const Navbar: React.FC<{ 
  lang: 'en' | 'ar', 
  setLang: (l: 'en' | 'ar') => void, 
  strings: LanguageStrings 
}> = ({ lang, setLang, strings }) => {
  const navigate = useNavigate();
  return (
    <nav className={`bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 ${lang === 'ar' ? 'rtl' : ''}`}>
      <h1 
        onClick={() => navigate('/')} 
        className="text-2xl font-bold text-indigo-600 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className="text-3xl">⚕️</span> {strings.title}
      </h1>
      <div className="flex gap-4 items-center">
        <button 
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm md:text-base"
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>
    </nav>
  );
};

// --- Main Application ---

const MedicineQuizApp: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('mq_subjects');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Internal Medicine', chapters: [{ id: '1-1', name: 'Cardiology' }, { id: '1-2', name: 'Pulmonology' }] },
      { id: '2', name: 'General Surgery', chapters: [{ id: '2-1', name: 'Trauma' }] }
    ];
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    const saved = localStorage.getItem('mq_attempts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const strings = TRANSLATIONS[lang];

  useEffect(() => {
    localStorage.setItem('mq_subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('mq_attempts', JSON.stringify(attempts));
  }, [attempts]);

  return (
    <div className={`min-h-screen bg-slate-50 ${lang === 'ar' ? 'rtl' : ''}`}>
      <Navbar lang={lang} setLang={setLang} strings={strings} />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Routes>
          <Route path="/" element={<Dashboard strings={strings} subjects={subjects} setSubjects={setSubjects} attempts={attempts} />} />
          <Route path="/create" element={<CreateQuiz strings={strings} subjects={subjects} lang={lang} />} />
          <Route path="/quiz/:quizId" element={<QuizInterface strings={strings} lang={lang} setAttempts={setAttempts} />} />
          <Route path="/stats" element={<StatsView strings={strings} attempts={attempts} />} />
          <Route path="/leaderboard" element={<Leaderboard strings={strings} attempts={attempts} />} />
        </Routes>
      </main>
    </div>
  );
};

// --- Sub-Views ---

const Dashboard: React.FC<{ 
  strings: LanguageStrings, 
  subjects: Subject[], 
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>,
  attempts: QuizAttempt[]
}> = ({ strings, subjects, setSubjects, attempts }) => {
  const navigate = useNavigate();
  const [newSubject, setNewSubject] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState('');

  const addSubject = () => {
    if (!newSubject.trim()) return;
    setSubjects(prev => [...prev, { id: Date.now().toString(), name: newSubject, chapters: [] }]);
    setNewSubject('');
  };

  const addChapter = (subjectId: string) => {
    if (!newChapter.trim()) return;
    setSubjects(prev => prev.map(s => s.id === subjectId ? {
      ...s,
      chapters: [...s.chapters, { id: `${subjectId}-${Date.now()}`, name: newChapter }]
    } : s));
    setNewChapter('');
  };

  const totalAttempts = attempts.length;
  const avgScore = totalAttempts > 0 
    ? (attempts.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / totalAttempts * 100).toFixed(1)
    : '0';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            📚 {strings.subjects}
          </h2>
          <div className="flex gap-2 mb-6">
            <input 
              type="text" 
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder={strings.subjects + "..."}
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
            <button onClick={addSubject} className="px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold">+</button>
          </div>
          <div className="space-y-3">
            {subjects.map(s => (
              <div key={s.id} className="border border-slate-100 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setActiveSubjectId(activeSubjectId === s.id ? null : s.id)}
                  className={`w-full p-4 flex justify-between items-center transition-colors ${activeSubjectId === s.id ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-xs px-2 py-1 bg-white rounded-full border border-slate-200">{s.chapters.length} Chaps</span>
                </button>
                {activeSubjectId === s.id && (
                  <div className="p-4 bg-white space-y-2 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                    {s.chapters.map(c => (
                      <div key={c.id} className="text-sm p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all flex justify-between items-center">
                        <span>• {c.name}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                      <input 
                        type="text" 
                        value={newChapter}
                        onChange={(e) => setNewChapter(e.target.value)}
                        placeholder={strings.chapters + "..."}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                      />
                      <button onClick={() => addChapter(s.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">Add</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={() => navigate('/create')}
          className="w-full py-5 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-700 transition-all font-bold text-xl flex items-center justify-center gap-3 hover:-translate-y-1"
        >
          ✨ {strings.generateQuiz}
        </button>
      </div>

      {/* Main Stats Summary */}
      <div className="lg:col-span-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total Quizzes" value={totalAttempts} color="bg-blue-500" icon="📝" />
          <StatCard label="Avg Score" value={`${avgScore}%`} color="bg-emerald-500" icon="🎯" />
          <StatCard label="Time Spent" value={`${attempts.reduce((a, b) => a + b.timeSpent, 0)}m`} color="bg-amber-500" icon="⏱️" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🚀 Quick Navigation</h2>
            <div className="grid grid-cols-2 gap-4">
              <NavButton onClick={() => navigate('/stats')} icon="📊" label={strings.stats} />
              <NavButton onClick={() => navigate('/leaderboard')} icon="🏆" label={strings.leaderboard} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">📉 Latest Activity</h2>
            {attempts.length === 0 ? (
              <p className="text-slate-400 text-sm italic py-8 text-center">No recent activity found.</p>
            ) : (
              <div className="space-y-3">
                {attempts.slice(-3).reverse().map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm font-medium">Quiz #{a.quizId.slice(0, 4)}</span>
                    <span className="text-sm font-bold text-indigo-600">{Math.round((a.score/a.totalQuestions)*100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string | number, color: string, icon: string }> = ({ label, value, color, icon }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
    <div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-800">{value}</p>
    </div>
    <div className={`w-14 h-14 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center text-2xl`}>
      {icon}
    </div>
  </div>
);

const NavButton: React.FC<{ onClick: () => void, icon: string, label: string }> = ({ onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className="p-6 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-3 hover:-translate-y-1 hover:shadow-sm"
  >
    <span className="text-3xl">{icon}</span>
    <span className="font-bold text-slate-700">{label}</span>
  </button>
);

const CreateQuiz: React.FC<{ strings: LanguageStrings, subjects: Subject[], lang: 'en' | 'ar' }> = ({ strings, subjects, lang }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [type, setType] = useState<QuestionType>(QuestionType.MIX);
  const [mixPercentage, setMixPercentage] = useState(50); // 50% MCQs
  const [count, setCount] = useState(20);
  const [targetLanguage, setTargetLanguage] = useState<'en' | 'ar' | 'original'>('original');

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleGenerate = async () => {
    if (files.length === 0) return alert('Please upload content');
    setLoading(true);

    try {
      let combinedText = '';
      for (const file of files) {
        const text = await file.text();
        combinedText += `\nFILE: ${file.name}\nCONTENT: ${text}\n`;
      }

      const promptModifier = type === QuestionType.MIX ? `Generate exactly ${count} questions. Approximately ${mixPercentage}% should be MCQ and ${100 - mixPercentage}% should be True/False.` : '';
      
      const generatedQuestions = await generateMedicalQuestions(
        combinedText, 
        count, 
        type, 
        difficulty, 
        targetLanguage
      );
      
      const newQuiz: Quiz = {
        id: Math.random().toString(36).substr(2, 9),
        title: `Quiz on ${selectedSubject?.name || 'Medical Content'}`,
        subjectId: selectedSubjectId,
        chapterId: selectedChapterId,
        difficulty,
        questions: generatedQuestions,
        createdAt: Date.now()
      };

      const savedQuizzes = JSON.parse(localStorage.getItem('mq_quizzes') || '[]');
      savedQuizzes.push(newQuiz);
      localStorage.setItem('mq_quizzes', JSON.stringify(savedQuizzes));

      navigate(`/quiz/${newQuiz.id}`);
    } catch (error) {
      console.error(error);
      alert('Error generating quiz. Please check your API key or content volume.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-100">
        <h2 className="text-4xl font-black mb-10 text-center text-slate-800">{strings.generateQuiz}</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-8">
            {/* File Upload Area */}
            <div className="group relative border-4 border-dashed border-indigo-100 rounded-[2rem] bg-indigo-50/30 hover:bg-indigo-50/60 hover:border-indigo-300 transition-all p-10 text-center">
              <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" id="file-upload" accept=".txt,.pdf" />
              <div className="space-y-3">
                <div className="text-6xl group-hover:scale-110 transition-transform duration-300">📁</div>
                <p className="text-xl font-bold text-indigo-700">{strings.uploadFiles}</p>
                <p className="text-slate-400 text-sm">PDF or Text files supported</p>
                {files.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {files.map((f, i) => (
                      <span key={i} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-full font-bold">{f.name.slice(0, 15)}...</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
               <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{strings.subjects}</label>
                <select 
                  value={selectedSubjectId} 
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {selectedSubject && selectedSubject.chapters.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{strings.chapters}</label>
                  <select 
                    value={selectedChapterId} 
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">Select Chapter</option>
                    {selectedSubject.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{strings.difficulty}</label>
                <select 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value={Difficulty.EASY}>{strings.easy}</option>
                  <option value={Difficulty.MEDIUM}>{strings.medium}</option>
                  <option value={Difficulty.HARD}>{strings.hard}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Question Type</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value as QuestionType)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value={QuestionType.MCQ}>{strings.mcq}</option>
                  <option value={QuestionType.TRUE_FALSE}>{strings.tf}</option>
                  <option value={QuestionType.MIX}>{strings.mix}</option>
                </select>
              </div>
            </div>

            {type === QuestionType.MIX && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Mix Balance</label>
                  <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded">{mixPercentage}% MCQ / {100-mixPercentage}% T/F</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" step="10"
                  value={mixPercentage} 
                  onChange={(e) => setMixPercentage(parseInt(e.target.value))}
                  className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{strings.questionCount} (1-200)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  value={count} 
                  onChange={(e) => setCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-center text-xl"
                />
                <div className="flex flex-col gap-1">
                  <button onClick={() => setCount(prev => Math.min(200, prev + 10))} className="p-2 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200">▲</button>
                  <button onClick={() => setCount(prev => Math.max(1, prev - 10))} className="p-2 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200">▼</button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider">{strings.translate}</label>
              <div className="flex gap-2">
                {(['original', 'ar', 'en'] as const).map(l => (
                  <button 
                    key={l}
                    onClick={() => setTargetLanguage(l)}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${targetLanguage === l ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-400'}`}
                  >
                    {l === 'original' ? strings.original : l === 'ar' ? strings.toArabic : strings.toEnglish}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={loading || files.length === 0}
          className="w-full mt-12 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[1.5rem] shadow-2xl hover:shadow-indigo-300 transition-all font-black text-2xl disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden relative"
        >
          <span className="relative z-10">{loading ? '🧠 AI Processing Data...' : strings.generateQuiz}</span>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
        </button>
      </div>
    </div>
  );
};

const QuizInterface: React.FC<{ strings: LanguageStrings, lang: 'en' | 'ar', setAttempts: React.Dispatch<React.SetStateAction<QuizAttempt[]>> }> = ({ strings, lang, setAttempts }) => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [startTime] = useState(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const savedQuizzes = JSON.parse(localStorage.getItem('mq_quizzes') || '[]');
    const found = savedQuizzes.find((q: Quiz) => q.id === quizId);
    if (found) setQuiz(found);
    // If not found, maybe it's a shared link? In a real app we'd fetch from DB. 
    // Here we handle local storage.
  }, [quizId]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard! Share it with friends.');
  };

  if (!quiz) return (
    <div className="text-center py-20 bg-white rounded-3xl shadow-sm">
      <div className="text-6xl animate-bounce mb-6">🔍</div>
      <h2 className="text-2xl font-bold text-slate-400">Quiz not found or expired.</h2>
      <button onClick={() => navigate('/')} className="mt-4 text-indigo-600 font-bold underline">Go back home</button>
    </div>
  );

  const currentQuestion = quiz.questions[currentIdx];
  const progress = ((currentIdx + 1) / quiz.questions.length) * 100;

  const handleAnswer = (ans: string) => {
    if (isFinished) return;
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: ans }));
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    setShowExplanation(false);
    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    const score = quiz.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correctAnswer ? 1 : 0), 0);
    const attempt: QuizAttempt = {
      id: Math.random().toString(36).substr(2, 9),
      quizId: quiz.id,
      userId: 'current-user-id',
      userName: 'Physician Pro',
      score,
      totalQuestions: quiz.questions.length,
      timeSpent: Math.round((Date.now() - startTime) / 60000),
      date: Date.now()
    };
    setAttempts(prev => [...prev, attempt]);
    setIsFinished(true);
  };

  if (isFinished) {
    const score = quiz.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correctAnswer ? 1 : 0), 0);
    const percentage = Math.round((score / quiz.questions.length) * 100);
    
    return (
      <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="text-8xl mb-6">🏁</div>
          <h2 className="text-4xl font-black mb-4 text-slate-800">{strings.results}</h2>
          <div className="flex flex-wrap justify-center gap-10 my-10">
            <ResultMetric label={strings.score} value={`${percentage}%`} subValue={`${score}/${quiz.questions.length}`} color="text-indigo-600" />
            <ResultMetric label={strings.time} value={`${Math.round((Date.now() - startTime)/1000)}s`} color="text-amber-500" />
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
             <button 
              onClick={() => navigate('/')}
              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all"
            >
              Home Dashboard
            </button>
            <button 
              onClick={handleShare}
              className="px-10 py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-2"
            >
              🔗 {strings.share}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-bold px-4">Review Answers</h3>
          {quiz.questions.map((q, idx) => {
            const isCorrect = userAnswers[q.id] === q.correctAnswer;
            return (
              <div key={q.id} className={`p-8 bg-white rounded-3xl shadow-sm border-2 transition-all ${isCorrect ? 'border-emerald-100' : 'border-rose-100'}`}>
                <div className="flex items-start gap-4">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>{idx + 1}</span>
                  <div className="flex-1">
                    <p className="font-bold text-lg mb-4 text-slate-800">{q.text}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className={`p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                        <span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Your Answer</span>
                        <span className="font-bold">{userAnswers[q.id] || 'Skipped'}</span>
                      </div>
                      {!isCorrect && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800">
                          <span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Correct Answer</span>
                          <span className="font-bold">{q.correctAnswer}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 bg-slate-50 rounded-2xl">
                      <span className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Scientific Explanation</span>
                      <p className="text-slate-600 text-sm italic leading-relaxed">{q.explanation}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Progress Floating Bar */}
      <div className="sticky top-20 z-40 mb-8 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="text-indigo-600 font-black text-xs uppercase tracking-tighter">Question {currentIdx + 1} of {quiz.questions.length}</span>
          <span className="text-slate-400 font-bold text-xs">{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 h-full transition-all duration-500 ease-out shadow-inner" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="bg-white p-8 md:p-14 rounded-[3rem] shadow-2xl border border-slate-100 transition-all duration-500 hover:shadow-indigo-100/50">
        <h3 className="text-2xl md:text-3xl font-black mb-12 text-slate-800 leading-tight">
          {currentQuestion.text}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(currentQuestion.options || ['True', 'False']).map((opt, i) => {
            const isSelected = userAnswers[currentQuestion.id] === opt;
            const isActuallyCorrect = opt === currentQuestion.correctAnswer;
            
            let btnClass = 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-700';
            if (isSelected) {
              btnClass = 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200 scale-105';
            }
            if (showExplanation) {
               if (isActuallyCorrect) btnClass = 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100';
               else if (isSelected) btnClass = 'bg-rose-500 border-rose-500 text-white';
            }

            return (
              <button
                key={i}
                disabled={showExplanation}
                onClick={() => handleAnswer(opt)}
                className={`group text-left p-6 rounded-3xl border-2 transition-all duration-300 flex items-center gap-5 ${btnClass} disabled:opacity-100`}
              >
                <span className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center font-black text-lg transition-colors ${isSelected ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-400'}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-bold text-lg">{opt}</span>
              </button>
            );
          })}
        </div>

        {showExplanation && (
          <div className="mt-12 p-8 bg-indigo-50 rounded-3xl border border-indigo-100 animate-in fade-in slide-in-from-top-4 duration-500">
            <h4 className="font-black text-indigo-800 mb-3 flex items-center gap-2 text-lg">
              {userAnswers[currentQuestion.id] === currentQuestion.correctAnswer ? '✅ Correct Insight' : '❌ Clinical Review'}
            </h4>
            <p className="text-indigo-900/70 font-medium leading-relaxed italic">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        <div className="mt-14 flex justify-between items-center">
           <button
            onClick={() => navigate('/')}
            className="text-slate-400 font-bold hover:text-rose-500 transition-colors"
          >
            Cancel Quiz
          </button>
          
          <button
            onClick={nextQuestion}
            disabled={!userAnswers[currentQuestion.id]}
            className="px-12 py-5 bg-slate-900 text-white rounded-3xl font-black shadow-2xl hover:bg-indigo-600 transition-all disabled:opacity-30 flex items-center gap-3 group"
          >
            {currentIdx === quiz.questions.length - 1 ? strings.results : 'Next Case'}
            <span className={`group-hover:translate-x-1 transition-transform ${lang === 'ar' ? 'rotate-180 group-hover:-translate-x-1' : ''}`}>➜</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ResultMetric: React.FC<{ label: string, value: string | number, subValue?: string, color: string }> = ({ label, value, subValue, color }) => (
  <div className="text-center group">
    <p className={`text-6xl font-black ${color} mb-1 group-hover:scale-110 transition-transform`}>{value}</p>
    {subValue && <p className="text-slate-800 font-bold text-xl">{subValue}</p>}
    <p className="text-slate-400 uppercase text-xs font-black tracking-widest mt-2">{label}</p>
  </div>
);

const StatsView: React.FC<{ strings: LanguageStrings, attempts: QuizAttempt[] }> = ({ strings, attempts }) => {
  const chartData = useMemo(() => {
    return attempts.slice(-10).map((a, i) => ({
      name: `Attempt ${i + 1}`,
      score: Math.round((a.score / a.totalQuestions) * 100),
      time: a.timeSpent
    }));
  }, [attempts]);

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50">
        <h2 className="text-3xl font-black mb-8 text-slate-800">Learning Curve</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
              <Tooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '15px'}}
              />
              <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.score >= 70 ? '#10b981' : entry.score >= 50 ? '#6366f1' : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50">
        <h2 className="text-3xl font-black mb-8 text-slate-800">Scientific Records</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Scientific Score</th>
                <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Duration</th>
                <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {attempts.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-20 text-slate-400 italic">No exams completed yet. Start your journey today!</td></tr>
              ) : (
                attempts.slice().reverse().map(a => {
                  const pct = (a.score/a.totalQuestions)*100;
                  return (
                    <tr key={a.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-bold text-slate-700">{new Date(a.date).toLocaleDateString()}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                           <span className={`w-3 h-3 rounded-full ${pct >= 70 ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                           <span className="font-black text-slate-900">{a.score} / {a.totalQuestions}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-medium">{a.timeSpent} mins</td>
                      <td className="px-6 py-5">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${pct >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {pct >= 50 ? 'Passed' : 'Review Required'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Leaderboard: React.FC<{ strings: LanguageStrings, attempts: QuizAttempt[] }> = ({ strings, attempts }) => {
  const board = useMemo(() => {
    // In a real app we'd fetch top scores from everyone. 
    // Here we simulate some mock "friends" for competition.
    const mockFriends = [
      { id: 'f1', userName: 'Dr. Sarah Smith', score: 18, totalQuestions: 20, date: Date.now() - 100000 },
      { id: 'f2', userName: 'Dr. Ahmed Ali', score: 15, totalQuestions: 20, date: Date.now() - 200000 },
      { id: 'f3', userName: 'Med Student 2024', score: 19, totalQuestions: 20, date: Date.now() - 50000 },
    ];
    
    const all = [...attempts.map(a => ({...a, isUser: true})), ...mockFriends.map(f => ({...f, isUser: false}))];
    return all.sort((a, b) => (b.score / b.totalQuestions) - (a.score / a.totalQuestions)).slice(0, 10);
  }, [attempts]);

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-50">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white text-center">
          <div className="inline-block p-4 bg-white/20 rounded-3xl mb-4 text-4xl">👑</div>
          <h2 className="text-4xl font-black mb-2">{strings.leaderboard}</h2>
          <p className="opacity-80 font-bold uppercase tracking-widest text-xs">Medical Excellence Rankings</p>
        </div>
        
        <div className="p-8 space-y-4 bg-slate-50/50">
          {board.map((item, idx) => (
            <div 
              key={item.id} 
              className={`flex items-center gap-6 p-6 rounded-[2rem] transition-all transform hover:-translate-y-1 hover:shadow-lg ${item.isUser ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-800'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${idx === 0 ? 'bg-amber-400 text-amber-900 shadow-lg shadow-amber-200' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-orange-900' : item.isUser ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg truncate">{item.userName} {item.isUser && '(You)'}</p>
                <p className={`text-xs font-bold uppercase tracking-wider ${item.isUser ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(item.date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-black ${item.isUser ? 'text-white' : 'text-indigo-600'}`}>{Math.round((item.score / item.totalQuestions) * 100)}%</p>
                <p className={`text-xs font-bold ${item.isUser ? 'text-indigo-200' : 'text-slate-400'}`}>{item.score}/{item.totalQuestions}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <MedicineQuizApp />
    </Router>
  );
}
