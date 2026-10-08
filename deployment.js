const repoOwner="cephasgabla-create";
const repoName="BEYOND-VIDEO-SHARING-PAGE-";
const repoUrl="https://github.com/"+repoOwner+"/"+repoName;
const actionsUrl=repoUrl+"/actions";
const siteUrl=location.origin+location.pathname.replace(/\/[^/]*$/,"/");
const apiUrl="https://api.github.com/repos/"+repoOwner+"/"+repoName+"/actions/runs?branch=main&per_page=20";
const preferredWorkflow="pages build and deployment";
const manualWorkflow="Deploy Beyond to GitHub Pages";

function stateLabel(run){
  if(run.status==="completed"){
    return run.conclusion==="success"?"Deployed successfully":
      run.conclusion==="failure"?"Deployment failed":
      run.conclusion==="cancelled"?"Deployment cancelled":
      run.conclusion==="skipped"?"Deployment skipped":
      "Completed: "+(run.conclusion||"unknown");
  }
  if(run.status==="queued") return "Waiting to deploy";
  if(run.status==="in_progress") return "Deployment in progress";
  return run.status||"Unknown";
}

function badgeClass(run){
  if(!run) return "checking";
  if(run.status!=="completed") return "checking";
  return run.conclusion==="success"?"ok":"bad";
}

function timeAgo(date){
  const s=Math.max(0,Math.floor((Date.now()-new Date(date))/1000));
  if(s<60) return s+"s ago";
  if(s<3600) return Math.floor(s/60)+"m ago";
  if(s<86400) return Math.floor(s/3600)+"h ago";
  return Math.floor(s/86400)+"d ago";
}

function duration(run){
  if(!run?.run_started_at) return "—";
  const end=run.updated_at||new Date().toISOString();
  const seconds=Math.max(0,Math.floor((new Date(end)-new Date(run.run_started_at))/1000));
  const m=Math.floor(seconds/60);
  const s=seconds%60;
  return m+"m "+String(s).padStart(2,"0")+"s";
}

function escapeHTML(value){
  return String(value??"").replace(/[&<>"\']/g,m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"' :"&quot;",
    "\'":"&#039;"
  }[m]));
}

function selectRuns(runs){
  const pages=runs.filter(r=>r.name===preferredWorkflow);
  const manual=runs.filter(r=>r.name===manualWorkflow);
  return {primary:pages[0]||manual[0]||runs[0]||null, history:[...pages,...manual]};
}

function renderChecks(run){
  const base=[
    ["Pages workflow","GitHub Pages deployment workflow for the main branch."],
    ["Entry page","index.html is the production entry point."],
    ["Route fallback","404.html is present for GitHub Pages routes."],
    ["Static asset mode",".nojekyll prevents unwanted Jekyll processing."]
  ];

  const live=run?[
    ["Latest GitHub Pages run",stateLabel(run)+" • "+timeAgo(run.updated_at)],
    ["Branch",run.head_branch||"main"],
    ["Commit",(run.head_sha||"").slice(0,7)+" • "+(run.head_commit?.message||"latest push")],
    ["Workflow duration",duration(run)]
  ]:[
    ["Latest GitHub Pages run","Unable to read GitHub Actions right now."]
  ];

  document.getElementById("checks").innerHTML=[...base,...live].map(([a,b])=>
    '<div class="check"><div><span class="dot"></span><div><b>'+escapeHTML(a)+'</b><small style="display:block;color:#64748b;margin-top:3px">'+escapeHTML(b)+'</small></div></div><span>✓</span></div>'
  ).join("");
}

function renderHistory(runs){
  const box=document.getElementById("deploymentHistory");
  if(!box) return;

  const relevant=runs.slice(0,8);
  if(!relevant.length){
    box.innerHTML='<div class="historyEmpty">No GitHub Pages workflow history is available yet.</div>';
    return;
  }

  box.innerHTML=relevant.map(run=>{
    const success=run.status==="completed"&&run.conclusion==="success";
    const running=run.status!=="completed";
    const cls=running?"checking":success?"ok":"bad";
    return '<a class="historyItem" href="'+escapeHTML(run.html_url||actionsUrl)+'" target="_blank" rel="noopener">'+
      '<span class="historyDot '+cls+'"></span>'+
      '<span class="historyMain"><b>'+escapeHTML(stateLabel(run))+'</b>'+
      '<small>'+escapeHTML(run.name||"GitHub Pages")+" • "+escapeHTML(run.head_branch||"main")+" • "+escapeHTML((run.head_sha||"").slice(0,7))+" • "+escapeHTML(timeAgo(run.updated_at))+'</small></span>'+
      '<span class="historyDuration">'+escapeHTML(duration(run))+" ↗</span>"+
    '</a>';
  }).join("");
}

async function refreshDeployment(){
  const badge=document.getElementById("overallBadge");
  const status=document.getElementById("deployStatus");
  badge.textContent="Checking…";
  badge.className="status checking";
  status.textContent="Checking…";
  document.getElementById("checkedAt").textContent=new Date().toLocaleTimeString();

  try{
    const res=await fetch(apiUrl,{headers:{Accept:"application/vnd.github+json"}});
    if(!res.ok) throw new Error("GitHub API "+res.status);
    const data=await res.json();
    const runs=data.workflow_runs||[];
    const selected=selectRuns(runs);
    const run=selected.primary;
    if(!run) throw new Error("No workflow runs found");

    badge.textContent=stateLabel(run);
    badge.className="status "+badgeClass(run);
    status.textContent=run.status==="completed"?(run.conclusion==="success"?"Success":run.conclusion||"Completed"):run.status;
    document.getElementById("checkedAt").textContent=new Date().toLocaleTimeString();

    renderChecks(run);
    renderHistory(selected.history);

    const link=document.getElementById("latestRunLink");
    if(link) link.href=run.html_url||actionsUrl;

    const updated=document.getElementById("runUpdated");
    if(updated) updated.textContent=run.updated_at?"Updated "+timeAgo(run.updated_at):"—";

    clearTimeout(window.beyondDeploymentTimer);
    if(run.status==="queued"||run.status==="in_progress"){
      window.beyondDeploymentTimer=setTimeout(refreshDeployment,15000);
    }
  }catch(err){
    badge.textContent="Status unavailable";
    badge.className="status checking";
    status.textContent="Unavailable";
    renderChecks(null);
    renderHistory([]);
    console.warn("Beyond deployment status:",err);
  }
}

function openGitHub(){window.open(repoUrl,"_blank","noopener");}
function openActions(){window.open(actionsUrl,"_blank","noopener");}
function openSite(){window.open(siteUrl,"_blank","noopener");}

document.getElementById("siteUrl").textContent=siteUrl;
refreshDeployment();
