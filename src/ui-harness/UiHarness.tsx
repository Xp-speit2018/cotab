import { useState } from "react";
import {
  ExternalLink,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Undo2,
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
import {
  AppMenu,
  AppMenuBar,
  AppMenuButton,
  AppMenuCheckboxItem,
  AppMenuControl,
  AppMenuGroup,
  AppMenuItem,
  AppMenuLink,
  AppMenuPanel,
  AppMenuRadioGroup,
  AppMenuRadioItem,
  AppMenuSeparator,
} from "@/components/ui/app-menu";

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

function AppMenuSample() {
  const [autoSave, setAutoSave] = useState(true);
  const [layout, setLayout] = useState("parchment");
  const [language, setLanguage] = useState("English");

  return (
    <div className="px-3" data-harness-menu-bar>
      <AppMenuBar ariaLabel="Application menu">
        <AppMenu label="File">
          <AppMenuPanel>
            <p className="text-xs font-medium">Saved</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Local file · Harness.cotab
            </p>
          </AppMenuPanel>
          <AppMenuSeparator />
          <AppMenuItem icon={Save} shortcut="Ctrl+S" onSelect={() => {}}>
            Save
          </AppMenuItem>
        </AppMenu>

        <AppMenu label="Edit">
          <AppMenuGroup>
            <AppMenuItem icon={Undo2} shortcut="Ctrl+Z" onSelect={() => {}}>
              Undo
            </AppMenuItem>
          </AppMenuGroup>
          <AppMenuSeparator />
          <AppMenuGroup label="Beat">
            <AppMenuItem onSelect={() => {}}>Insert Rest Before</AppMenuItem>
            <AppMenuItem onSelect={() => {}}>Insert Rest After</AppMenuItem>
          </AppMenuGroup>
          <AppMenuSeparator />
          <AppMenuGroup label="Track">
            <AppMenuItem onSelect={() => {}}>New Track...</AppMenuItem>
          </AppMenuGroup>
        </AppMenu>

        <AppMenu label="Layout">
          <AppMenuGroup label="Score layout">
            <AppMenuRadioGroup value={layout} onValueChange={setLayout}>
              <AppMenuRadioItem value="horizontal">
                Horizontal layout
              </AppMenuRadioItem>
              <AppMenuRadioItem value="parchment">
                Parchment layout
              </AppMenuRadioItem>
            </AppMenuRadioGroup>
          </AppMenuGroup>
          <AppMenuGroup label="Parchment layout">
            <AppMenuCheckboxItem
              checked={false}
              closeOnSelect={false}
              onSelect={() => {}}
            >
              Edit score layout
            </AppMenuCheckboxItem>
            <AppMenuButton icon={Settings}>Layout settings</AppMenuButton>
          </AppMenuGroup>
          <AppMenuSeparator />
          <AppMenuGroup label="View">
            <AppMenuControl>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Zoom</span>
                <span className="font-mono tabular-nums">100%</span>
              </div>
              <input
                type="range"
                aria-label="Zoom"
                min="25"
                max="200"
                defaultValue="100"
                className="w-full"
              />
            </AppMenuControl>
          </AppMenuGroup>
        </AppMenu>

        <AppMenu label="Preferences">
          <AppMenuGroup label="General">
            <AppMenuCheckboxItem
              checked={autoSave}
              closeOnSelect={false}
              onSelect={() => setAutoSave((value) => !value)}
            >
              Auto-save
            </AppMenuCheckboxItem>
          </AppMenuGroup>
          <AppMenuSeparator />
          <AppMenuGroup label="Language">
            <AppMenuRadioGroup value={language} onValueChange={setLanguage}>
              <AppMenuRadioItem value="English">English</AppMenuRadioItem>
              <AppMenuRadioItem value="简体中文">简体中文</AppMenuRadioItem>
            </AppMenuRadioGroup>
          </AppMenuGroup>
        </AppMenu>

        <AppMenu label="Help">
          <AppMenuItem icon={Settings} onSelect={() => {}}>
            About CoTab
          </AppMenuItem>
          <AppMenuLink href="https://github.com/Xp-speit2018/cotab" icon={ExternalLink}>
            Project on GitHub
          </AppMenuLink>
        </AppMenu>
      </AppMenuBar>
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
          <ContractSection title="Application menu">
            <AppMenuSample />
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
