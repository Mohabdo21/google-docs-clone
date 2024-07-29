import { useEffect, useState, useRef, useCallback } from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { useParams } from "react-router-dom";
import Gun from "gun";
import "codemirror/lib/codemirror.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/selection/mark-selection";

const SAVE_INTERVAL_MS = 2000;

export default function TextEditor() {
  const { id: documentId } = useParams();
  const [gun, setGun] = useState(null);
  const [doc, setDoc] = useState(null);
  const [value, setValue] = useState("");
  const [cursors, setCursors] = useState({});
  const editorRef = useRef(null);
  const isTyping = useRef(false);

  useEffect(() => {
    const gunInstance = Gun({
      peers: ["http://localhost:3001/gun"],
    });
    setGun(gunInstance);

    return () => {
      gunInstance.leave();
    };
  }, []);

  useEffect(() => {
    if (!gun) return;

    const docRef = gun.get(documentId);
    setDoc(docRef);

    docRef.on((data) => {
      if (!isTyping.current) {
        setValue(data.content || "");
      }
    });

    gun.get(`cursor_${documentId}`).on((data) => {
      setCursors((prevCursors) => ({ ...prevCursors, ...data }));
    });

    return () => {
      docRef.off();
    };
  }, [gun, documentId]);

  useEffect(() => {
    if (!doc) return;

    const interval = setInterval(() => {
      doc.put({ content: value });
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [doc, value]);

  const handleEditorChange = useCallback(
    (editor, data, value) => {
      isTyping.current = true;
      setValue(value);
      if (doc) {
        doc.put({ content: value });
      }
      setTimeout(() => {
        isTyping.current = false;
      }, 50); // Small delay to reduce flickering
    },
    [doc],
  );

  const handleCursorChange = (editor) => {
    if (gun) {
      const cursor = editor.getCursor();
      gun.get(`cursor_${documentId}`).put({ [documentId]: cursor });
    }
  };

  const renderCursors = (editor) => {
    Object.keys(cursors).forEach((key) => {
      if (key !== documentId) {
        const { line, ch } = cursors[key];
        const marker = document.createElement("span");
        marker.style.borderLeft = "2px solid red";
        marker.style.height = `${editor.defaultTextHeight()}px`;
        marker.style.marginLeft = "-1px";
        marker.className = `cursor-${key}`;
        editor.setBookmark({ line, ch }, { widget: marker });
      }
    });
  };

  useEffect(() => {
    if (editorRef.current) {
      renderCursors(editorRef.current);
    }
  }, [cursors]);

  return (
    <div className="container">
      <CodeMirror
        value={value}
        options={{
          mode: "javascript",
          theme: "dracula",
          lineNumbers: true,
          autoCloseBrackets: true,
          styleActiveLine: true,
          extraKeys: { "Ctrl-Space": "autocomplete" },
        }}
        onBeforeChange={(editor, data, value) => {
          setValue(value);
        }}
        onChange={handleEditorChange}
        editorDidMount={(editor) => {
          editorRef.current = editor;
          editor.on("cursorActivity", () => {
            handleCursorChange(editor);
          });
        }}
      />
    </div>
  );
}
