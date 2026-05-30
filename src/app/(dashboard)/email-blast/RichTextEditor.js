"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { useEffect, useCallback } from "react";

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        background: active ? "rgba(201,168,76,.18)" : "transparent",
        border: active ? "1px solid rgba(201,168,76,.4)" : "1px solid rgba(255,255,255,.08)",
        color: active ? "var(--gold, #C9A84C)" : "rgba(196,188,178,.7)",
        borderRadius: 3,
        padding: "3px 8px",
        cursor: "pointer",
        fontSize: 12,
        lineHeight: 1.4,
        minWidth: 28,
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { style: "color:#C9A84C;text-decoration:underline;" },
      }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        style: [
          "min-height:220px",
          "padding:12px 14px",
          "outline:none",
          "font-size:13px",
          "line-height:1.7",
          "color:rgba(250,246,240,.88)",
          "font-family:inherit",
        ].join(";"),
      },
    },
  });

  // Sync external value changes (e.g. loading a template)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const tb = editor.chain().focus();

  return (
    <div style={{ border: "1px solid rgba(201,168,76,.18)", borderRadius: 4, background: "rgba(0,0,0,.25)" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 10px",
        borderBottom: "1px solid rgba(201,168,76,.12)",
        background: "rgba(0,0,0,.2)",
      }}>
        <ToolbarBtn onClick={() => tb.toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <b>B</b>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <i>I</i>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <u>U</u>
        </ToolbarBtn>

        <div style={{ width: 1, background: "rgba(255,255,255,.1)", margin: "0 2px" }} />

        <ToolbarBtn onClick={() => tb.toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">
          H2
        </ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Subheading">
          H3
        </ToolbarBtn>

        <div style={{ width: 1, background: "rgba(255,255,255,.1)", margin: "0 2px" }} />

        <ToolbarBtn onClick={() => tb.toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          • List
        </ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          1. List
        </ToolbarBtn>

        <div style={{ width: 1, background: "rgba(255,255,255,.1)", margin: "0 2px" }} />

        <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Insert / edit link">
          🔗 Link
        </ToolbarBtn>
        {editor.isActive("link") && (
          <ToolbarBtn onClick={() => tb.unsetLink().run()} active={false} title="Remove link">
            ✕ Link
          </ToolbarBtn>
        )}

        <div style={{ width: 1, background: "rgba(255,255,255,.1)", margin: "0 2px" }} />

        <ToolbarBtn onClick={() => tb.clearNodes().unsetAllMarks().run()} active={false} title="Clear formatting">
          Tx
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
