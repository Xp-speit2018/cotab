import { useState } from "react";
import {
  ExternalLink,
  Plus,
  RotateCcw,
  Settings,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  EditableNumberPropRow,
  EditablePropRow,
  IconCommand,
  InspectorDisclosureRow,
  PopoverPropRow,
  SectionHeader,
  ToggleBtn,
} from "@/components/NoteEditorSidebar/primitives";
import { PresetCombobox } from "@/components/NoteEditorSidebar/PresetCombobox";
import { PasswordInput } from "@/components/ui/password-input";

function ContractSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border" data-harness-section={title}>
      <h2 className="px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground">
        {title}
      </h2>
      <div className="pb-3">{children}</div>
    </section>
  );
}

function SectionHeaderSample() {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SectionHeader
        title="Effects"
        helpText="Section help"
        isOpen={open}
        actions={(
          <IconCommand
            label="Add item"
            icon={<Plus className="h-3.5 w-3.5" />}
          />
        )}
      />
      <CollapsibleContent>
        <div className="px-4 py-2 text-[11px] text-muted-foreground">
          Section content
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DisclosureSamples() {
  const [open, setOpen] = useState(false);
  const [tuning, setTuning] = useState("standard");

  return (
    <div className="space-y-0.5">
      <InspectorDisclosureRow
        label="Instrument"
        value="Distortion Guitar"
        open={open}
        onClick={() => setOpen((value) => !value)}
      />
      <InspectorDisclosureRow
        label="Disabled"
        value="Unavailable"
        disabled
      />
      <PopoverPropRow
        label="Complex editor"
        value="Configured"
        title="Complex editor"
      >
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1 text-muted-foreground">
            <span>Numerator</span>
            <input className="h-8 w-full rounded border px-2 text-foreground" value="4" readOnly />
          </label>
          <label className="space-y-1 text-muted-foreground">
            <span>Denominator</span>
            <input className="h-8 w-full rounded border px-2 text-foreground" value="4" readOnly />
          </label>
        </div>
      </PopoverPropRow>
      <div className="flex items-center gap-2 px-3 py-0.5">
        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
          Tuning preset
        </span>
        <PresetCombobox
          value={tuning}
          ariaLabel="Tuning preset"
          options={[
            { value: "standard", label: "Standard" },
            { value: "drop-d", label: "Drop D" },
            { value: "dadgad", label: "DADGAD" },
          ]}
          onValueChange={setTuning}
          triggerClassName="ml-auto h-6 min-w-24 max-w-36 border-0 px-1.5 text-[11px] shadow-none"
        />
      </div>
    </div>
  );
}

function InlineEditSamples() {
  const [title, setTitle] = useState("Taijin Kyofusho");
  const [tempo, setTempo] = useState(70);

  return (
    <div className="space-y-0.5">
      <EditablePropRow
        label="Title"
        value={title}
        placeholder="Untitled"
        onCommit={setTitle}
      />
      <EditablePropRow
        label="Long value"
        value="A deliberately long value used to verify truncation at inspector width"
        onCommit={() => {}}
      />
      <EditableNumberPropRow
        label="Tempo"
        value={tempo}
        suffix="BPM"
        min={20}
        max={400}
        onCommit={setTempo}
      />
    </div>
  );
}

function CommandSamples() {
  const [loop, setLoop] = useState(false);

  return (
    <div className="flex items-center gap-2 px-3">
      <IconCommand
        label="Settings"
        onClick={() => {}}
        icon={<Settings className="h-3.5 w-3.5" />}
      />
      <ToggleBtn
        label="Loop"
        pressed={loop}
        onPressedChange={setLoop}
        icon={<RotateCcw className="h-3.5 w-3.5" />}
      />
      <IconCommand
        label="Disabled command"
        disabled
        icon={<Settings className="h-3.5 w-3.5" />}
      />
      <a
        href="https://alphatab.net"
        data-interaction="link"
        className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[11px] text-primary hover:underline"
      >
        alphaTab
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function SensitiveInputSample() {
  const [password, setPassword] = useState("cotab-dev");

  return (
    <div className="px-3">
      <label
        htmlFor="harness-password"
        className="block text-[11px] text-muted-foreground"
      >
        Password
      </label>
      <PasswordInput
        id="harness-password"
        value={password}
        revealLabel="Hold to show password"
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
    </div>
  );
}

export default function UiHarness() {
  return (
    <main
      data-ui-harness
      className="h-screen overflow-auto bg-background text-foreground"
    >
      <header className="sticky top-0 z-10 flex h-11 items-center border-b bg-background px-3">
        <h1 className="text-sm font-semibold">CoTab UI Harness</h1>
        <code className="ml-auto text-[10px] text-muted-foreground">
          /__ui-harness
        </code>
      </header>
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-6 p-4 md:grid-cols-[320px_1fr]">
        <div
          data-harness-inspector
          className="w-full min-w-0 border border-border bg-sidebar text-sidebar-foreground md:w-80"
        >
          <ContractSection title="Section">
            <SectionHeaderSample />
          </ContractSection>
          <ContractSection title="Disclosure and choice">
            <DisclosureSamples />
          </ContractSection>
          <ContractSection title="Inline edit">
            <InlineEditSamples />
          </ContractSection>
          <ContractSection title="Commands">
            <CommandSamples />
          </ContractSection>
          <ContractSection title="Sensitive input">
            <SensitiveInputSample />
          </ContractSection>
        </div>
        <div className="min-w-0 border-y border-border py-4">
          <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 px-3 text-xs">
            <dt className="text-muted-foreground">Command</dt>
            <dd>Default cursor, hover emphasis, tooltip</dd>
            <dt className="text-muted-foreground">Toggle</dt>
            <dd>Command behavior with pressed state</dd>
            <dt className="text-muted-foreground">Disclosure</dt>
            <dd>Full-row target with expanded state</dd>
            <dt className="text-muted-foreground">Inline edit</dt>
            <dd>Default label, text cursor value, loose commit</dd>
            <dt className="text-muted-foreground">Link</dt>
            <dd>Pointer cursor reserved for navigation</dd>
          </dl>
        </div>
      </div>
    </main>
  );
}
