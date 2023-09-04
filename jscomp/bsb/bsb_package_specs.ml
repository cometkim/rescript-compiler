(* Copyright (C) 2017 Hongbo Zhang, Authors of ReScript
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * In addition to the permissions granted to you by the LGPL, you may combine
 * or link a "work that uses the Library" with a publicly distributed version
 * of this file to produce a combined library or application, then distribute
 * that combined work under the terms of your choosing, with no requirement
 * to comply with the obligations normally placed on you by section 4 of the
 * LGPL version 3 (or the corresponding section of a later version of the LGPL
 * should you choose to use a later version).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA. *)

let ( // ) = Ext_path.combine

(*FIXME: use assoc list instead *)
module Spec_set = Bsb_spec_set

type t = {
  modules : Spec_set.t;
  runtime : string option;
      (* This has to be resolved as early as possible, since
         the path will be inherited in sub projects
      *)
}

let string_of_format (x : Ext_module_system.t) =
  match x with
  | NodeJS -> Literals.commonjs
  | Es6 -> Literals.es6
  | Es6_global -> Literals.es6_global

let bs_package_output = "-bs-package-output"

[@@@warning "+9"]

(* Assume input is valid
    coordinate with command line flag
    {[ -bs-package-output commonjs:lib/js/jscomp/test:.js ]}
*)
let package_flag ({ format; in_source; suffix } : Bsb_spec_set.spec) dir =
  Ext_string.inter2 bs_package_output
    (Ext_string.concat5 (string_of_format format) Ext_string.single_colon
       (if in_source then dir
       else Bsb_config.top_prefix_of_format format // dir)
       Ext_string.single_colon
       (Ext_js_suffix.to_string suffix))

(* FIXME: we should adapt it *)
let package_flag_of_package_specs (package_specs : t) ~(dirname : string) :
    string =
  let res =
    match (package_specs.modules :> Bsb_spec_set.spec list) with
    | [] -> Ext_string.empty
    | [ format ] ->
        Ext_string.inter2 Ext_string.empty (package_flag format dirname)
    | [ a; b ] ->
        Ext_string.inter3 Ext_string.empty (package_flag a dirname)
          (package_flag b dirname)
    | [ a; b; c ] ->
        Ext_string.inter4 Ext_string.empty (package_flag a dirname)
          (package_flag b dirname) (package_flag c dirname)
    | _ ->
        Spec_set.fold
          (fun format acc ->
            Ext_string.inter2 acc (package_flag format dirname))
          package_specs.modules Ext_string.empty
  in
  match package_specs.runtime with
  | None -> res
  | Some x -> Ext_string.inter3 res "-runtime" x

(**
    [get_list_of_output_js specs "src/hi/hello"]

*)
let get_list_of_output_js (package_specs : t)
    (output_file_sans_extension : string) =
  Spec_set.fold
    (fun (spec : Bsb_spec_set.spec) acc ->
      let basename =
        Ext_namespace.change_ext_ns_suffix output_file_sans_extension
          (Ext_js_suffix.to_string spec.suffix)
      in
      (if spec.in_source then Bsb_config.rev_lib_bs_prefix basename
      else Bsb_config.lib_bs_prefix_of_format spec.format // basename)
      :: acc)
    package_specs.modules []

let list_dirs_by (package_specs : t) (f : string -> unit) =
  Spec_set.iter
    (fun (spec : Bsb_spec_set.spec) ->
      if not spec.in_source then f (Bsb_config.top_prefix_of_format spec.format))
    package_specs.modules

let from_manifest ~(cwd : string) (manifest : Bsb_manifest_types.t) =
  let modules = manifest.package_specs in
  let runtime =
    match manifest.external_stdlib with
    | None -> None
    | Some stdlib ->
        Some
          (Bsb_pkg.resolve_bs_package ~cwd
             (Bsb_pkg_types.string_as_package stdlib))
  in
  { runtime; modules }
