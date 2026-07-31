import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileItem, Instance } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { Folder, FileCode, Plus, Save, ChevronRight, ArrowLeft, Check, Trash2, Upload } from 'lucide-react';

function getLanguageFromFileName(filename: string): string {
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.sh')) return 'shell';
  if (filename.endsWith('.env')) return 'ini';
  return 'plaintext';
}

export const ProjectFiles: React.FC = () => {
  const { instance } = useOutletContext<{ instance: Instance }>();
  const { theme } = useTheme();

  const [currentDir, setCurrentDir] = useState('/');
  const [currentFiles, setCurrentFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getHeaders = (): Record<string, string> => {
    const storedToken = localStorage.getItem('cc_token');
    return storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
  };

  const fetchDirectoryFiles = (dirPath: string) => {
    setLoading(true);
    fetch(`/api/instances/${instance.id}/files?dir=${encodeURIComponent(dirPath)}`, {
      credentials: 'include',
      headers: getHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.files)) {
          setCurrentFiles(data.files);
        } else {
          setCurrentFiles([]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDirectoryFiles(currentDir);
  }, [instance.id, currentDir]);

  const handleOpenFile = async (file: FileItem) => {
    if (file.isDirectory) {
      setCurrentDir(file.path);
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
      setIsSaved(false);
      try {
        const res = await fetch(`/api/instances/${instance.id}/files/read?path=${encodeURIComponent(file.path)}`, {
          credentials: 'include',
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setEditedCode(data.content || '');
        }
      } catch (err) {
        setEditedCode('');
      }
    }
  };

  const handleSaveCode = async () => {
    if (!selectedFile) return;
    try {
      const res = await fetch(`/api/instances/${instance.id}/files/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          path: selectedFile.path,
          content: editedCode,
        }),
      });

      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const filePath = currentDir === '/' ? `/${newFileName}` : `${currentDir}/${newFileName}`;
    try {
      await fetch(`/api/instances/${instance.id}/files/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          path: filePath,
          content: '// New source file\n',
        }),
      });
      setNewFileName('');
      setIsCreatingFile(false);
      fetchDirectoryFiles(currentDir);
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetDir', currentDir);

    try {
      setLoading(true);
      const res = await fetch(`/api/instances/${instance.id}/files/upload`, {
        method: 'POST',
        headers: getHeaders(),
        body: formData,
      });

      if (res.ok) {
        fetchDirectoryFiles(currentDir);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="h-[calc(100vh-12rem)] flex flex-col md:flex-row overflow-hidden border shadow-sm">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* Left File Tree Panel */}
      <div className="w-full md:w-64 border-r flex flex-col bg-muted/10">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-semibold">
            {currentDir !== '/' && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCurrentDir('/')}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            <span className="font-mono truncate">{currentDir}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} title="上傳檔案">
              <Upload className="h-3.5 w-3.5 text-primary" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsCreatingFile(true)} title="新增檔案">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isCreatingFile && (
          <div className="p-2 border-b bg-background flex gap-2">
            <Input
              placeholder="filename.js"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="h-7 text-xs font-mono"
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreateFile}>
              OK
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground font-mono">Loading files...</div>
          ) : currentFiles.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground italic">No files in directory</div>
          ) : (
            [...currentFiles]
              .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
              })
              .map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleOpenFile(file)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-colors ${
                    selectedFile?.path === file.path
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'hover:bg-accent text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate font-mono">
                    {file.isDirectory ? (
                      <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <FileCode className="h-4 w-4 shrink-0" />
                    )}
                    <span>{file.name}</span>
                  </div>
                  {file.isDirectory && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                </button>
              ))
          )}
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedFile ? (
          <>
            <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold">
                <FileCode className="h-4 w-4 text-primary" />
                <span>{selectedFile.path}</span>
                <Badge variant="secondary" className="text-[10px] font-mono py-0 uppercase">
                  {getLanguageFromFileName(selectedFile.name)}
                </Badge>
              </div>

              <Button size="sm" onClick={handleSaveCode} className="gap-1.5 text-xs font-bold">
                {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
                {isSaved ? '已儲存' : '儲存檔案 (Ctrl+S)'}
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language={getLanguageFromFileName(selectedFile.name)}
                value={editedCode}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                onChange={(val) => setEditedCode(val || '')}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8 text-muted-foreground text-xs">
            點擊左側檔案開啟 VS Code 編輯器
          </div>
        )}
      </div>
    </Card>
  );
};
