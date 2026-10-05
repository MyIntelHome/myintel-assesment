import type { SpaceType } from "@/domain/types";

/** Decorative room drawings; the adjacent room name supplies the accessible label. */
export function RoomArt({type="living",dimmed=false}:{type?:SpaceType;dimmed?:boolean}) {
  return <svg className={`room-art${dimmed?" room-art--dimmed":""}`} viewBox="0 0 200 150" aria-hidden="true" focusable="false">
    <path fill="#f2eee7" d="M12 132V29L100 8l88 21v103Z"/>
    <path fill="#d6e9f8" d="M117 79V43a22 22 0 0 1 44 0v36Z"/>
    <path fill="#f6c35c" opacity=".45" d="m117 79 44-21 26 74h-94Z"/>
    <g fill="none" stroke="#1e3258" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M117 79V43a22 22 0 0 1 44 0v36Zm22-57v57m-22-25h44M16 132h168"/>
      {type==="living" && <><path fill="#fff" d="M35 96V77q0-9 9-9h47q9 0 9 9v19m-65 0h65v25H35Z"/><path d="M27 88h12v33H27Zm69 0h12v33H96ZM38 122v7m58-7v7M52 88h30"/></>}
      {type==="bedroom" && <><path fill="#fff" d="M30 91h77v30H30Z"/><path d="M30 91V67h77v24M30 121v8m77-8v8"/><path fill="#e6f1fb" d="M37 77h26v14H37Zm34 0h27v14H71Z"/></>}
      {type==="kitchen" && <><path fill="#fff" d="M27 81h80v45H27Z"/><path d="M24 81h87M54 81v45m27-45v45M36 91h9m17 0h9M32 67h67v14H32Zm13 0v-8q0-9 10-9v12"/></>}
      {type==="bathroom" && <><path fill="#fff" d="M25 85h81l-8 30H36Z"/><path d="M40 115v10m51-10v10M34 85V65q0-10 11-10v10M24 83h86"/></>}
      {type==="entry" && <><path fill="#fff" d="M34 126V39h66v87Z"/><path d="M44 116V49h46v67M83 87h1M25 128h85"/></>}
      {type==="stairway" && <><path fill="#fff" d="M24 126v-15h21V96h21V81h21V66h20v60Z"/><path d="m26 88 78-55M34 83v18m26-35v20m26-37v20"/></>}
      {type==="exterior" && <><path d="M64 128V73m0 26L46 84m18 7 16-15"/><path fill="#e2f5ea" d="M42 77q-13-29 13-32 6-25 26-8 24 1 20 23 13 25-19 29-23 9-40-12Z"/><path d="M119 110h47m-39 0v18m30-18v18"/></>}
    </g>
  </svg>;
}
