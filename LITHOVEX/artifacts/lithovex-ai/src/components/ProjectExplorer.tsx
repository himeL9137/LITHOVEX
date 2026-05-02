import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { FileText, FolderPlus, FilePlus, Trash, Play, Activity } from "lucide-react";
import { Textarea } from "./ui/textarea";

interface ProjectExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  projectContext: string;
  setProjectContext: (v: string) => void;
}

export function ProjectExplorer({ isOpen, onClose, projectContext, setProjectContext }: ProjectExplorerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[80vw] sm:max-w-[80vw] bg-[#0a1428] border-l border-[#1f2937] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-[#1f2937] bg-[#111827]">
          <SheetTitle className="text-[#f5b800] flex items-center">
            <Activity className="mr-2 h-5 w-5" />
            LITHOVEX AI Project Explorer
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - File Tree placeholder */}
          <div className="w-64 border-r border-[#1f2937] bg-[#111827] flex flex-col">
            <div className="p-2 flex gap-1 border-b border-[#1f2937]">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#f5b800]">
                <FilePlus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#f5b800]">
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400">
                <Trash className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-green-400">
                <Play className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 p-2 text-sm text-gray-500 overflow-y-auto">
              <div className="flex items-center gap-2 p-1 hover:bg-[#1f2937] rounded cursor-pointer text-gray-300">
                <FileText className="h-4 w-4 text-blue-400" />
                context.txt
              </div>
              {/* Add more mock files if needed */}
            </div>
          </div>

          {/* Right panel - Editor */}
          <div className="flex-1 flex flex-col bg-[#0a1428]">
            <div className="p-2 border-b border-[#1f2937] bg-[#111827] flex justify-between items-center">
              <span className="text-sm font-mono text-gray-400">context.txt</span>
              <div className="text-xs text-gray-500 font-mono">
                {projectContext.split('\n').length} lines | {projectContext.length} chars
              </div>
            </div>
            <div className="flex-1 p-4">
              <Textarea 
                value={projectContext}
                onChange={(e) => setProjectContext(e.target.value)}
                placeholder="Paste file contents or project context here to make it available to the AI..."
                className="w-full h-full font-mono text-sm bg-[#111827] border-[#1f2937] text-gray-300 focus-visible:ring-[#f5b800] resize-none"
              />
            </div>
            <div className="p-4 border-t border-[#1f2937] bg-[#111827]">
              <h3 className="text-sm font-medium text-gray-400 mb-2">AI Agent Changes</h3>
              <div className="h-32 bg-[#0a1428] rounded border border-[#1f2937] p-2 text-xs font-mono text-gray-500 overflow-y-auto">
                No recent automated changes.
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}