type t = Bsb_manifest_types.Jsx.t

let encode_no_nl (jsx : t) =
  (match jsx.version with
  | None -> ""
  | Some Jsx_v3 -> "3"
  | Some Jsx_v4 -> "4")
  ^ (match jsx.module_ with None -> "" | Some React -> "React")
  ^
  match jsx.mode with
  | None -> ""
  | Some Classic -> "Classic"
  | Some Automatic -> "Automatic"
