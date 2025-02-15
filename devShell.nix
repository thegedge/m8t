{ mkShell
, packages
}:
mkShell {
  packages = builtins.attrValues packages;

  shellHook = ''
    # Nothing
  '';
}
