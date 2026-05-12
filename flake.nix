{
  description = "Static site generator emphasizing a minimal core with extensibility";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      nixpkgs.lib.fix (
        flake:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          callPackage = pkgs.newScope (flake.packages // { inherit callPackage; });
        in
        {
          packages = {
            direnv = pkgs.direnv;
            nix-direnv = pkgs.nix-direnv;
            node = pkgs.nodejs_25;
          };

          devShell = callPackage ./devShell.nix {
            mkShell = pkgs.mkShellNoCC;
            packages = flake.packages;
          };
        }
      )
    );
}
