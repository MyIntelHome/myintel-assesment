import type {HomeProfile} from "./home-profile";
import type {FamilyReport} from "./family-report";
import type {ServiceType} from "./services";
export interface HomeAction {id:string;label:string;title:string;why:string;step:string;service?:ServiceType}
const simple:Record<string,string>={l2:"Ask someone to help clear the usual walking route. Start with small items; leave heavy furniture to someone who can move it safely.",l4:"Arrange for cords to be routed away from the usual walking path.",l6:"Choose a reachable place for a charged phone and agree who to call.",k2:"Ask someone to bring frequently used items within comfortable reach.",k3:"Clear an accessible place to set items beside the preparation area.",k7:"Ask someone to move frequently used items down so climbing is not needed."};
export function homeActions(report:FamilyReport,p?:HomeProfile):HomeAction[]{
 const result:HomeAction[]=[],known=report.priority.filter(e=>!e.uncertain),diy=known.find(e=>simple[e.code]);
 if(diy)result.push({id:"simple",label:"A simple first step",title:"Start with an everyday adjustment",why:`You reported a concern in ${diy.spaceLabel}: ${diy.question}`,step:simple[diy.code]!});
 const modification=known.find(e=>["e1","e4","e5","b1","b2","b3","s1","s2"].includes(e.code));
 if(modification)result.push({id:"modification",label:"Plan with a professional",title:"Check fit before making a home change",why:`You reported a concern in ${modification.spaceLabel}: ${modification.question}`,step:"Ask for a review of the space, the resident’s needs and the installation requirements before buying or fitting equipment. Confirm the work, price and permissions first.",service:"home_modifications"});
 const helpGap=p?.helpReach==="no"||p?.helpReach==="unsure";
 if(helpGap)result.push({id:"help",label:"Make a support plan",title:"Agree how help would be reached",why:p?.helpReach==="unsure"?"You were unsure how help would be reached.":"You reported a gap in reaching help.",step:"Discuss a way to call for help from the spaces used most, who would respond and a backup if that person is unavailable.",service:"care_navigation"});
 const techWanted=p?.technology==="interested"||p?.technology==="help";
 if(techWanted)result.push({id:"technology",label:"An option to explore",title:helpGap?"Compare ways to call for help":"Choose one problem for technology to solve",why:"You asked to explore technology. This is a preference, not a finding that equipment is needed.",step:(helpGap?"Ask about a reachable call button or alert system and who receives the alert. ":"Bring one specific difficulty from your results to a technology discussion—for example, reaching lights or contacting support. ")+"Compare setup, ongoing costs, privacy, connectivity and who will maintain it. Ask what happens if it stops working.",service:"technology_support"});
 if(report.unsureCount && !modification)result.push({id:"clarify",label:"Clarify before buying",title:"Get a second pair of eyes",why:`${report.unsureCount} answer${report.unsureCount===1?" was":"s were"} marked not sure.`,step:"Use the room details to choose what you want checked. A professional can help distinguish a change worth making from something that needs no purchase.",service:"professional_assessment"});
 return result;
}
export function homeActionsText(report:FamilyReport,p?:HomeProfile){const actions=homeActions(report,p);return actions.length?["PRACTICAL NEXT STEPS",...actions.flatMap(a=>[a.title,a.why,a.step,""])].join("\n"):""}
