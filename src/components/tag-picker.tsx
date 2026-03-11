"use client";

import { useState, useRef } from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createTag } from "@/lib/actions/tags";
import { toast } from "sonner";
import type { Tag } from "@/types";

const MAX_TAGS = 2;

interface TagPickerProps {
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export function TagPicker({ tags, selectedTagIds, onChange }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState("#6b7280");
  const [allTags, setAllTags] = useState(tags);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
  const isFull = selectedTagIds.length >= MAX_TAGS;

  const filtered = allTags.filter(
    (t) => t.name.includes(search.toLowerCase()) && !selectedTagIds.includes(t.id)
  );

  const exactMatch = allTags.some((t) => t.name === search.trim().toLowerCase());

  function handleSelect(tagId: string) {
    onChange([...selectedTagIds, tagId]);
    setSearch("");
    setOpen(false);
  }

  function handleRemove(tagId: string) {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  }

  async function handleCreate() {
    const name = search.trim();
    if (!name) return;

    setCreating(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", newColor);

    const result = await createTag(formData);

    if (result.error) {
      toast.error(result.error);
    } else if (result.tag) {
      setAllTags((prev) => [...prev, result.tag!]);
      onChange([...selectedTagIds, result.tag.id]);
      setSearch("");
      setOpen(false);
    }
    setCreating(false);
    setNewColor("#6b7280");
  }

  return (
    <div className="space-y-2">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pr-1"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemove(tag.id)}
                className="rounded-full p-0.5 hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {!isFull && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
            >
              <Plus className="mr-1 h-3 w-3" />
              Adicionar tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Buscar ou criar tag..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {search.trim() && !exactMatch ? (
                    <div className="p-2 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Criar &quot;{search.trim().toLowerCase()}&quot;
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          ref={colorInputRef}
                          type="color"
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          className="h-7 w-7 cursor-pointer rounded border-0 p-0"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 flex-1 text-xs"
                          onClick={handleCreate}
                          disabled={creating}
                        >
                          {creating ? "Criando..." : "Criar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-2">Nenhuma tag encontrada</p>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filtered.map((tag) => (
                    <CommandItem key={tag.id} value={tag.name} onSelect={() => handleSelect(tag.id)}>
                      <div
                        className="mr-2 h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                  {search.trim() && !exactMatch && filtered.length > 0 && (
                    <CommandItem onSelect={handleCreate}>
                      <Plus className="mr-2 h-3 w-3" />
                      Criar &quot;{search.trim().toLowerCase()}&quot;
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {isFull && (
        <p className="text-xs text-muted-foreground">Máximo de {MAX_TAGS} tags</p>
      )}
    </div>
  );
}
