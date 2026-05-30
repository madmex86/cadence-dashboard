"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

function ToolbarBtn({ onClick, active, title, children, style }) {
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
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, background: "rgba(255,255,255,.1)", margin: "0 2px", alignSelf: "stretch" }} />;
}

// Extract YouTube video ID from any YouTube URL
function getYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function RichTextEditor({ value, onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = [false, () => {}]; // local state via ref
  const uploadingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { style: "color:#C9A84C;text-decoration:underline;" },
      }),
      Image.configure({
        HTMLAttributes: { style: "max-width:100%;height:auto;display:block;margin:8px 0;" },
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

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL", prev);
    if (url === null) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const insertImageUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const handleFileUpload = useCallback(async (file) => {
    if (!editor || !file) return;
    if (uploadingRef.current) return;
    uploadingRef.current = true;

    const ext = file.name.split(".").pop().toLowerCase();
    const allowed = ["jpg", "jpeg", "png", "gif", "webp"];
    if (!allowed.includes(ext)) {
      alert("Please upload a JPG, PNG, GIF, or WebP image.");
      uploadingRef.current = false;
      return;
    }

    const supabase = createClient();
    const path = `email/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("email-assets").upload(path, file, { contentType: file.type });

    if (error) {
      alert("Upload failed: " + error.message);
      uploadingRef.current = false;
      return;
    }

    const { data } = supabase.storage.from("email-assets").getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl }).run();
    uploadingRef.current = false;
  }, [editor]);

  const insertVideo = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Video URL (YouTube, Vimeo, or any link)");
    if (!url) return;

    const ytId = getYouTubeId(url);
    if (ytId) {
      // Use YouTube's thumbnail as the image, linked to the video
      const thumb = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
      const html = `<a href="${url}" target="_blank" rel="noopener" style="display:block;position:relative;max-width:100%;">`
        + `<img src="${thumb}" alt="Video" style="max-width:100%;height:auto;display:block;"/>`
        + `<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);`
        + `background:rgba(0,0,0,.65);border-radius:50%;width:60px;height:60px;`
        + `display:flex;align-items:center;justify-content:center;`
        + `font-size:24px;color:#fff;pointer-events:none;">▶</span></a>`;
      editor.chain().focus().insertContent(html).run();
    } else {
      // Non-YouTube: insert as a styled text link
      const label = window.prompt("Button label", "▶ Watch Video") || "▶ Watch Video";
      const html = `<p><a href="${url}" target="_blank" rel="noopener" `
        + `style="display:inline-block;background:#C9A84C;color:#0e0c09;`
        + `padding:10px 20px;text-decoration:none;font-weight:bold;border-radius:3px;">`
        + `${label}</a></p>`;
      editor.chain().focus().insertContent(html).run();
    }
  }, [editor]);

  if (!editor) return null;

  const tb = editor.chain().focus();

  return (
    <div style={{ border: "1px solid rgba(201,168,76,.18)", borderRadius: 4, background: "rgba(0,0,0,.25)" }}>
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: "none" }}
        onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }}
      />

      {/* Toolbar */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 10px",
        borderBottom: "1px solid rgba(201,168,76,.12)",
        background: "rgba(0,0,0,.2)",
      }}>
        {/* Text formatting */}
        <ToolbarBtn onClick={() => tb.toggleBold().run()} active={editor.isActive("bold")} title="Bold"><b>B</b></ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleItalic().run()} active={editor.isActive("italic")} title="Italic"><i>I</i></ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleUnderline().run()} active={editor.isActive("underline")} title="Underline"><u>U</u></ToolbarBtn>

        <Divider />

        {/* Headings */}
        <ToolbarBtn onClick={() => tb.toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">H2</ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Subheading">H3</ToolbarBtn>

        <Divider />

        {/* Lists */}
        <ToolbarBtn onClick={() => tb.toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">• List</ToolbarBtn>
        <ToolbarBtn onClick={() => tb.toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">1. List</ToolbarBtn>

        <Divider />

        {/* Link */}
        <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Insert / edit link">🔗 Link</ToolbarBtn>
        {editor.isActive("link") && (
          <ToolbarBtn onClick={() => tb.unsetLink().run()} active={false} title="Remove link">✕ Link</ToolbarBtn>
        )}

        <Divider />

        {/* Photo */}
        <ToolbarBtn onClick={insertImageUrl} active={false} title="Insert image by URL">🌐 Photo URL</ToolbarBtn>
        <ToolbarBtn onClick={() => fileInputRef.current?.click()} active={false} title="Upload a photo from your computer">⬆ Upload Photo</ToolbarBtn>

        {/* Video */}
        <ToolbarBtn
          onClick={insertVideo}
          active={false}
          title="Insert a video thumbnail (YouTube auto-detects; other URLs get a button)"
          style={{ color: "rgba(91,191,212,.85)" }}
        >
          ▶ Video
        </ToolbarBtn>

        <Divider />

        {/* Clear formatting */}
        <ToolbarBtn onClick={() => tb.clearNodes().unsetAllMarks().run()} active={false} title="Clear all formatting">Tx</ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
