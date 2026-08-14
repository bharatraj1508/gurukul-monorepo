'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronRight, ChevronDown, BookOpen } from 'lucide-react';
import {
  useSyllabusTopics,
  useCreateSyllabusTopic,
  useUpdateSyllabusTopic,
  useDeleteSyllabusTopic,
  SyllabusTopic,
} from '@/services/api/requests/syllabus-topics';
import { usePermission } from '@/hooks/use-permission';
import { PERMS } from '@repo/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SyllabusManagerProps {
  courseId: string;
  courseName?: string;
}

interface TopicRowProps {
  topic: SyllabusTopic;
  courseId: string;
  depth?: number;
  canEdit: boolean;
  onAddChild: (parentId: string) => void;
}

function TopicRow({ topic, courseId, depth = 0, canEdit, onAddChild }: TopicRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(topic.title);
  const [isExpanded, setIsExpanded] = useState(true);

  const { mutateAsync: updateTopic } = useUpdateSyllabusTopic(courseId);
  const { mutateAsync: deleteTopic } = useDeleteSyllabusTopic(courseId);

  const hasChildren = topic.children && topic.children.length > 0;

  const handleSave = async () => {
    if (!editValue.trim()) return;
    try {
      await updateTopic({ id: topic.id, dto: { title: editValue.trim() } });
      setIsEditing(false);
      toast.success('Topic updated.');
    } catch {
      toast.error('Failed to update topic.');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${topic.title}"${hasChildren ? ' and all its sub-topics' : ''}?`)) return;
    try {
      await deleteTopic(topic.id);
      toast.success('Topic deleted.');
    } catch {
      toast.error('Failed to delete topic.');
    }
  };

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all hover:bg-muted/50',
          depth > 0 && 'ml-6 border-l border-border/50 pl-4',
        )}
        style={{ marginLeft: depth > 0 ? `${depth * 20}px` : undefined }}
      >
        {/* Expand/Collapse */}
        <button
          className="shrink-0 text-muted-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4 inline-block" />
          )}
        </button>

        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />

        {/* Title / Edit */}
        {isEditing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
                if (e.key === 'Escape') { setIsEditing(false); setEditValue(topic.title); }
              }}
              className="h-7 text-sm"
            />
            <Button size="sm" variant="default" onClick={() => void handleSave()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditValue(topic.title); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <span
            className="flex-1 cursor-pointer text-sm font-medium"
            onDoubleClick={() => canEdit && setIsEditing(true)}
          >
            {topic.title}
          </span>
        )}

        {/* Actions */}
        {canEdit && !isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => onAddChild(topic.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Sub-topic
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {topic.children.map((child) => (
            <TopicRow
              key={child.id}
              topic={child}
              courseId={courseId}
              depth={depth + 1}
              canEdit={canEdit}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SyllabusManagerContainer({ courseId, courseName }: SyllabusManagerProps) {
  const { hasPermission } = usePermission();
  const canEdit = hasPermission(PERMS.course.edit);

  const { data: topics, isLoading } = useSyllabusTopics(courseId);
  const { mutateAsync: createTopic } = useCreateSyllabusTopic(courseId);

  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [childTitle, setChildTitle] = useState('');

  const handleAddTopic = async () => {
    if (!newTopicTitle.trim()) return;
    try {
      await createTopic({ title: newTopicTitle.trim() });
      setNewTopicTitle('');
      toast.success('Topic added.');
    } catch {
      toast.error('Failed to add topic.');
    }
  };

  const handleAddChild = async (parentId: string) => {
    setActiveParentId(parentId);
    setChildTitle('');
  };

  const handleSaveChild = async () => {
    if (!childTitle.trim() || !activeParentId) return;
    try {
      await createTopic({ title: childTitle.trim(), parentId: activeParentId });
      setActiveParentId(null);
      setChildTitle('');
      toast.success('Sub-topic added.');
    } catch {
      toast.error('Failed to add sub-topic.');
    }
  };

  const topLevelTopics = topics?.filter((t) => !t.parentId) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Syllabus Topics</h2>
          {courseName && (
            <p className="text-sm text-muted-foreground">{courseName}</p>
          )}
        </div>
      </div>

      {/* Add new top-level topic */}
      {canEdit && (
        <div className="flex gap-2">
          <Input
            placeholder="Add a new topic..."
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAddTopic(); }}
            className="max-w-md"
          />
          <Button onClick={() => void handleAddTopic()} disabled={!newTopicTitle.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Topic
          </Button>
        </div>
      )}

      {/* Topic tree */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Loading syllabus...
          </div>
        ) : topLevelTopics.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No topics yet</p>
            {canEdit && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add topics above to build the course syllabus.
              </p>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {topLevelTopics.map((topic) => (
              <div key={topic.id}>
                <TopicRow
                  topic={topic}
                  courseId={courseId}
                  canEdit={canEdit}
                  onAddChild={handleAddChild}
                />
                {/* Inline child-add form */}
                {activeParentId === topic.id && (
                  <div
                    className="ml-10 mt-1 mb-2 flex gap-2 items-center"
                  >
                    <Input
                      autoFocus
                      placeholder="Sub-topic title..."
                      value={childTitle}
                      onChange={(e) => setChildTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveChild();
                        if (e.key === 'Escape') setActiveParentId(null);
                      }}
                      className="h-8 text-sm max-w-xs"
                    />
                    <Button size="sm" onClick={() => void handleSaveChild()}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setActiveParentId(null)}>Cancel</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
