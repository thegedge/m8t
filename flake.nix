{
  description = "Static site generator emphasizing a minimal core with extensibility";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs?ref=staging-next";
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
            node = pkgs.nodejs; # needed for esbuild
            bun = pkgs.bun.overrideAttrs (
              final: prev: with pkgs; rec {
                version = "1.2.2";
                src =
                  passthru.sources.${stdenvNoCC.hostPlatform.system}
                    or (throw "Unsupported system: ${stdenvNoCC.hostPlatform.system}");
                passthru = prev.passthru // {
                  sources = prev.passthru.sources // {
                    "aarch64-darwin" = fetchurl {
                      url = "https://github.com/oven-sh/bun/releases/download/bun-v1.2.2/bun-darwin-aarch64.zip";
                      hash = "sha256-xNWOBsXDOIW1JvTZGjjKnr25/D+0zVR/fTMCBVyY5Bw=";
                    };
                  };
                };
              }
            );
            direnv = pkgs.direnv;
            nix-direnv = pkgs.nix-direnv;
          };

          devShell = callPackage ./devShell.nix {
            mkShell = pkgs.mkShellNoCC;
            packages = flake.packages;
          };
        }
      )
    );
}
