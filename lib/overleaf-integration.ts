export function createOverleafProject(latexCode: string, projectName: string) {
  // Create a shareable Overleaf link
  const encodedCode = encodeURIComponent(latexCode);
  const overleafUrl = `https://www.overleaf.com/docs?snip_uri=data:application/x-latex;base64,${btoa(latexCode)}`;
  
  window.open(overleafUrl, '_blank');
}

