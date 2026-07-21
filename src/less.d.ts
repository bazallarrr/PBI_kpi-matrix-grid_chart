// Ambient module declaration for .less side-effect imports (e.g.
// `import "./../style/visual.less";` in visual.ts). Needed once
// tsconfig.json's moduleResolution moved from the deprecated "node10"
// classic mode to "bundler" - the stricter resolver otherwise can't
// resolve a non-JS/TS asset import and errors out, even though webpack
// (via pbiviz's build) handles it correctly at bundle time regardless.
declare module "*.less" {
    const content: { [className: string]: string };
    export default content;
}
