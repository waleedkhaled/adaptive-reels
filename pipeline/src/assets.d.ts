declare module '*.css';

/** Font files imported by the Remotion bundle resolve to a URL (webpack asset/resource). */
declare module '*.ttf' {
  const url: string;
  export default url;
}
