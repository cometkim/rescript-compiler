(* Copyright (C) 2015-2016 Bloomberg Finance L.P.
 * Copyright (C) 2017 - Hongbo Zhang, Authors of ReScript
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

type dependency = {
  package_name : Bsb_pkg_types.t;
  package_install_path : string;
}

type ppx_spec = {
  name : string;
  args : string list;
  resolved_path : string;
}

type dependencies = dependency list

type t = {
  manifest : Bsb_manifest_types.t;
  manifest_filename : string;
  manifest_absolute_path : string;
  bs_dependencies : dependencies;
  bs_dev_dependencies : dependencies;
  pinned_dependencies : Set_string.t;
  built_in_dependency : bool;
  ppx_files : ppx_spec list;
  pp_file : string option;
  package_specs : Bsb_package_specs.t;
  file_groups : Bsb_file_groups.t;
  files_to_install : Bsb_db.module_info Queue.t;
  runtime_path : string option;
}
