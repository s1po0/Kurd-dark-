// -----------------------------------------------------------------------------
//  File: Construction/ConstructionSystem.cs
//  Purpose: Owns the build/demolish/repair lifecycle:
//    * placement validation (physical rules from MapGrid + funds + territory)
//    * construction sites progressed by assigned builder peasants
//    * storage capacity and aura recalculation when the castle changes
//    * damage, collapse into rubble, rubble clearing
//    * gate toggling which rewrites the navigation costs
//
//  Every occupancy write goes through MapGrid.Occupy/Release so navigation is
//  always consistent with the world.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Economy;
using KurdCastle.World;

namespace KurdCastle.Construction
{
    public sealed class ConstructionSystem
    {
        readonly MapGrid _grid;
        readonly TerrainMap _terrain;
        readonly NavigationGrid _nav;
        readonly BuildingRegistry _registry;
        readonly ResourceLedger _ledger;
        readonly GameStateManager _state;

        readonly List<BuildingInstance> _storageScratch = new List<BuildingInstance>(32);
        readonly List<BuildingInstance> _auraScratch = new List<BuildingInstance>(128);

        public ConstructionSystem(MapGrid grid, TerrainMap terrain, NavigationGrid nav,
                                  BuildingRegistry registry, ResourceLedger ledger, GameStateManager state)
        {
            _grid = grid;
            _terrain = terrain;
            _nav = nav;
            _registry = registry;
            _ledger = ledger;
            _state = state;
        }

        /// <summary>Set by GameWorld once the keep exists; drives build territory.</summary>
        public Int2 KeepCell { get; set; } = new Int2(-1, -1);
        public Int2 EnemyCampCell { get; set; } = new Int2(-1, -1);
        public int TerritoryRadius { get; set; } = 15;
        /// <summary>New buildings must be within this distance of an existing friendly one.</summary>
        public int TerritoryLinkRadius { get; set; } = 9;

        public BuildingRegistry Registry { get { return _registry; } }

        // =====================================================================
        //  Placement
        // =====================================================================
        public PlacementError ValidatePlacement(BuildingId id, Int2 cell, Team team)
        {
            var def = BuildingCatalog.Get(id);
            if (def.Id == BuildingId.None) return PlacementError.Unknown;

            var rect = IntRect.FromCenter(cell, def.Footprint.x, def.Footprint.y);

            var physical = _grid.Validate(def, rect);
            if (physical != PlacementError.Ok) return physical;

            if (def.MustTouchOwnTerritory && !IsWithinTerritory(rect, team))
                return PlacementError.MustTouchTerritory;

            if (!_ledger.CanAfford(team, def.Cost)) return PlacementError.CannotAfford;

            // Walls/towers must connect to something, otherwise players paint orphans.
            if ((def.IsWall || def.IsTower || def.IsGate) && !_grid.TouchesStructure(rect, 1)
                && !IsWithinTerritory(rect, team, 2))
                return PlacementError.MustTouchTerritory;

            return PlacementError.Ok;
        }

        /// <summary>Free preview used by the ghost: physical rules only (cheap, no ledger).</summary>
        public PlacementError ValidateGhost(BuildingId id, Int2 cell, Team team)
        {
            var def = BuildingCatalog.Get(id);
            if (def.Id == BuildingId.None) return PlacementError.Unknown;
            var rect = IntRect.FromCenter(cell, def.Footprint.x, def.Footprint.y);
            var physical = _grid.Validate(def, rect);
            if (physical != PlacementError.Ok) return physical;
            if (def.MustTouchOwnTerritory && !IsWithinTerritory(rect, team))
                return PlacementError.MustTouchTerritory;
            return PlacementError.Ok;
        }

        public bool IsWithinTerritory(IntRect rect, Team team)
        {
            var center = rect.Center;

            // The keep anchors territory; every other building extends it.
            Int2 anchor = team == Team.Player ? KeepCell : EnemyCampCell;
            if (anchor.x >= 0 && anchor.ChebyshevTo(center) <= TerritoryRadius) return true;

            for (int i = 0; i < _registry.All.Count; i++)
            {
                var b = _registry.All[i];
                if (b == null || b.Team != team || b.IsRubble) continue;
                if (b.Rect.Center.ChebyshevTo(center) <= TerritoryLinkRadius) return true;
            }
            return false;
        }

        public bool TryPlace(BuildingId id, Int2 cell, Team team, bool instant = false,
                             out BuildingInstance placed, out PlacementError error)
        {
            placed = null;
            error = ValidatePlacement(id, cell, team);
            if (error != PlacementError.Ok)
            {
                EventBus.Publish(new BuildRejectedEvent
                {
                    Id = id, Reason = error, Cell = new Vector2Int(cell.x, cell.y),
                });
                return false;
            }

            var def = BuildingCatalog.Get(id);
            var rect = IntRect.FromCenter(cell, def.Footprint.x, def.Footprint.y);

            if (!instant && !_ledger.TrySpend(team, def.Cost)) return false;

            // Reserve first: two placements in the same frame must not overlap.
            _grid.Reserve(rect, false);
            var building = _registry.Create(def, team, rect);

            byte navGround, navBypass;
            NavigationGrid.CostsFor(def, out navGround, out navBypass);
            // Sites are solid too: peasants shouldn't walk through a half-built wall.
            _grid.Occupy(rect, building.Handle, navGround, navBypass, def.ClearsVegetation);
            _nav.Invalidate();

            if (def.IsGate) _grid.SetGate(rect, true, NavigationGrid.GateCost);

            if (instant)
            {
                FinishConstruction(building);
            }
            else
            {
                building.IsConstructionSite = true;
                building.BuildProgress = 0f;
                building.Health = Mathf.Max(1f, def.MaxHealth * 0.25f);
                if (building.WorkerSlots.Length < BuildersNeeded(def))
                    building.WorkerSlots = new int[BuildersNeeded(def)];
                for (int i = 0; i < building.WorkerSlots.Length; i++) building.WorkerSlots[i] = Handle.Invalid;
                EventBus.Publish(new ToastEvent
                {
                    Message = def.DisplayName + " site ready — peasants will build it",
                    Duration = 2f, Severity = ToastSeverity.Info,
                });
            }

            _registry.MarkPlaced(building);
            RecalculateStorageCaps();
            RecalculateAuras();
            placed = building;
            if (team == Team.Player && _state != null) _state.ScoreBuildingsRaised++;
            return true;
        }

        public int BuildersNeeded(BuildingDefinition def)
        {
            return Mathf.Clamp(Mathf.CeilToInt(def.Footprint.x * def.Footprint.y * 0.5f), 1, 6);
        }

        void FinishConstruction(BuildingInstance b)
        {
            b.IsConstructionSite = false;
            b.BuildProgress = 1f;
            b.Health = b.MaxHealth;
            b.IsRubble = false;

            EventBus.Publish(new BuildingPlacedEvent
            {
                Id = b.Definition.Id, Team = b.Team,
                Origin = new Vector2Int(b.Rect.x, b.Rect.y),
            });
            EventBus.Publish(new ToastEvent
            {
                Message = b.Definition.DisplayName + " completed",
                Duration = 2.4f, Severity = ToastSeverity.Success,
            });

            if (b.Definition.Id == BuildingId.Keep && b.Team == Team.Player)
                KeepCell = b.Rect.Center;
        }

        // =====================================================================
        //  Per-tick
        // =====================================================================
        public void Tick(float dt)
        {
            for (int i = 0; i < _registry.All.Count; i++)
            {
                var b = _registry.All[i];
                if (b == null) continue;

                if (b.DamageFlash > 0f) b.DamageFlash = Mathf.Max(0f, b.DamageFlash - dt * 2.4f);

                if (b.IsRubble)
                {
                    b.RubbleTimer -= dt;
                    if (b.RubbleTimer <= 0f) ClearRubble(b);
                    continue;
                }

                if (b.IsConstructionSite)
                {
                    AdvanceConstruction(b, dt);
                    continue;
                }

                if (b.RepairQueued && b.Health < b.MaxHealth) Repair(b, dt);
                if (b.Definition.IsGate) b.GateOpen = _grid.IsGateOpen(b.Rect.Center);

                // Automated defences tick here so all four tower stats stay in one place.
                if (b.Definition.DefenseRange > 0f && b.DefenseCooldown > 0f)
                    b.DefenseCooldown = Mathf.Max(0f, b.DefenseCooldown - dt);
            }
        }

        void AdvanceConstruction(BuildingInstance b, float dt)
        {
            int builders = b.WorkerCount;
            if (builders <= 0) return;

            float share = buildProgressRate(b.Definition, builders);
            b.BuildProgress += share * dt;
            b.Health = Mathf.Lerp(b.MaxHealth * 0.25f, b.MaxHealth, Mathf.Clamp01(b.BuildProgress));

            if (b.BuildProgress >= 1f) FinishConstruction(b);
        }

        /// <summary>One builder finishes a small building in BuildTimeSeconds; more builders scale sublinearly.</summary>
        public static float BuildProgressPerSecond(BuildingDefinition def, int builders)
        {
            if (builders <= 0) return 0f;
            float baseRate = 1f / Mathf.Max(0.5f, def.BuildTimeSeconds);
            float scale = 0.6f + 0.4f * builders;
            return baseRate * Mathf.Min(scale, 2.4f);
        }

        float buildProgressRate(BuildingDefinition def, int builders)
        {
            return BuildProgressPerSecond(def, builders);
        }

        // =====================================================================
        //  Repair / damage / removal
        // =====================================================================
        public bool QueueRepair(BuildingInstance b, bool queued)
        {
            if (b == null || b.IsRubble) return false;
            b.RepairQueued = queued;
            EventBus.Publish(new RepairOrderedEvent
            {
                Cell = new Vector2Int(b.Rect.x, b.Rect.y), Queued = queued,
            });
            return true;
        }

        void Repair(BuildingInstance b, float dt)
        {
            float missing = b.MaxHealth - b.Health;
            if (missing <= 0.5f) { b.RepairQueued = false; return; }

            float heal = b.Definition.RepairRate * dt;
            heal = Mathf.Min(heal, missing);

            // Repairs cost stone and iron, charged per hit point restored.
            int stoneCost = Mathf.CeilToInt(heal * Balance.Economy.RepairCostPerHp);
            int stone = Mathf.Min(stoneCost, _ledger.Get(b.Team, ResourceType.Stone));
            if (stone <= 0)
            {
                if (_state != null && b.Team == Team.Player)
                    EventBus.Publish(ToastEvent.Warn("Out of stone — repairs stalled"));
                b.RepairQueued = false;
                return;
            }

            _ledger.Take(b.Team, ResourceType.Stone, stone);
            b.Health += heal;
            if (b.Health >= b.MaxHealth) { b.Health = b.MaxHealth; b.RepairQueued = false; }
        }

        /// <summary>Applies damage from combat. Returns true when the building was destroyed.</summary>
        public bool Damage(BuildingInstance b, float amount, DamageType type, Team attacker)
        {
            if (b == null || b.IsRubble || b.IsDestroyed) return false;

            b.Damage(amount, type);

            if (b.Team == Team.Player)
            {
                EventBus.Publish(new UnderAttackEvent
                {
                    Active = true, Cell = new Vector2Int(b.Rect.x, b.Rect.y), AttackedTeam = Team.Player,
                });
            }

            if (b.Health > 0f) return false;

            Collapse(b, attacker);
            return true;
        }

        void Collapse(BuildingInstance b, Team attacker)
        {
            b.IsDestroyed = true;
            b.IsConstructionSite = false;
            _grid.ReleaseNav(b.Rect);
            _nav.Invalidate();

            var def = b.Definition;
            EventBus.Publish(new BuildingDestroyedEvent
            {
                Id = def.Id, Team = b.Team, Origin = new Vector2Int(b.Rect.x, b.Rect.y),
            });
            EventBus.Publish(new CameraShakeEvent
            {
                Magnitude = def.Footprint.x * def.Footprint.y > 4 ? 0.35f : 0.12f,
                Duration = 0.35f, WorldPosition = b.Center,
            });

            if (b.Team == Team.Player)
            {
                if (attacker == Team.Enemy)
                    EventBus.Publish(ToastEvent.Bad(def.DisplayName + " destroyed!"));
                _state.ScoreBuildingsRaised = Mathf.Max(0, _state.ScoreBuildingsRaised - 1);
            }

            if (def.LeavesRubble)
            {
                b.IsRubble = true;
                b.RubbleTimer = def.RuinClearSeconds;
                // The rubble still owns its footprint, so the registry count is
                // unchanged here; ReleaseNav() below opens the cells for pathing.
            }
            else
            {
                _grid.Release(b.Rect);
                _registry.Remove(b, true);
            }

            RecalculateStorageCaps();
            RecalculateAuras();

            if (def.IsKeep && b.Team == Team.Player)
            {
                PlayerKeepLost?.Invoke();
            }
        }

        public System.Action PlayerKeepLost;

        void ClearRubble(BuildingInstance b)
        {
            _grid.Release(b.Rect);
            _nav.Invalidate();
            _registry.Remove(b, false);
            EventBus.Publish(new ToastEvent
            {
                Message = "Rubble cleared", Duration = 1.6f, Severity = ToastSeverity.Info,
            });
        }

        /// <summary>Player-ordered demolition: refunds salvage, frees the footprint.</summary>
        public bool Demolish(BuildingInstance b)
        {
            if (b == null || b.IsRubble) return false;
            if (b.Definition.IsKeep) return false;      // you cannot knock down your own keep

            var salvage = b.Definition.Cost * Balance.Economy.SalvageRatio;
            _ledger.AddBundle(b.Team, salvage);
            _grid.Release(b.Rect);
            _nav.Invalidate();
            _registry.Remove(b, false);
            RecalculateStorageCaps();
            RecalculateAuras();

            EventBus.Publish(new ToastEvent
            {
                Message = b.Definition.DisplayName + " demolished (+" + salvage.ToShortString() + ")",
                Duration = 2f, Severity = ToastSeverity.Info,
            });
            return true;
        }

        // =====================================================================
        //  Gates
        // =====================================================================
        public bool ToggleGate(BuildingInstance b)
        {
            if (b == null || !b.Definition.IsGate) return false;
            bool open = !_grid.IsGateOpen(b.Rect.Center);
            _grid.SetGate(b.Rect, open, NavigationGrid.GateCost);
            b.GateOpen = open;
            _nav.Invalidate();
            EventBus.Publish(new GateToggledEvent { Cell = new Vector2Int(b.Rect.x, b.Rect.y), Open = open });
            return true;
        }

        public void SetAllGates(Team team, bool open)
        {
            _registry.ForEach(b =>
            {
                if (b.Team == team && b.Definition.IsGate)
                {
                    _grid.SetGate(b.Rect, open, NavigationGrid.GateCost);
                    b.GateOpen = open;
                }
            });
            _nav.Invalidate();
            EventBus.Publish(new ToastEvent
            {
                Message = open ? "Gates opened" : "Gates sealed",
                Duration = 1.8f, Severity = ToastSeverity.Info,
            });
        }

        // =====================================================================
        //  Derived state (capacity, auras)
        // =====================================================================
        public void RecalculateStorageCaps()
        {
            for (int teamIdx = 1; teamIdx <= 2; teamIdx++)
            {
                var team = (Team)teamIdx;
                var caps = ResourceCost.Zero;
                caps.Wood = Balance.Economy.BaseStorageWood;
                caps.Stone = Balance.Economy.BaseStorageStone;
                caps.Iron = Balance.Economy.BaseStorageIron;
                caps.Food = Balance.Economy.BaseStorageFood;
                caps.Weapons = Balance.Economy.BaseStorageWeapons;
                caps.Armor = Balance.Economy.BaseStorageArmor;
                caps.Ale = Balance.Economy.BaseStorageAle;

                for (int i = 0; i < _registry.All.Count; i++)
                {
                    var b = _registry.All[i];
                    if (b == null || b.Team != team || !b.IsOperational) continue;
                    caps = caps + b.Definition.StorageBonus;
                }

                for (int r = 0; r < ResourceUtil.Count; r++)
                {
                    var type = (ResourceType)r;
                    int cap = type == ResourceType.Gold ? Balance.Economy.GoldCap : caps[type];
                    _ledger.SetCapacity(team, type, cap);
                }
            }
        }

        /// <summary>
        /// Recomputes neighbour bonuses (mills boosting farms) and district auras.
        /// Cheap enough to run on every castle change instead of every tick.
        /// </summary>
        public void RecalculateAuras()
        {
            _auraScratch.Clear();
            for (int i = 0; i < _registry.All.Count; i++)
            {
                var b = _registry.All[i];
                if (b != null && b.IsOperational) _auraScratch.Add(b);
            }

            for (int i = 0; i < _auraScratch.Count; i++) _auraScratch[i].WorkerBonus = 1f;

            for (int i = 0; i < _auraScratch.Count; i++)
            {
                var mill = _auraScratch[i];
                if (mill.Definition.Id != BuildingId.Mill || !mill.IsOperational) continue;
                float radius = mill.AuraRadius;
                for (int j = 0; j < _auraScratch.Count; j++)
                {
                    var farm = _auraScratch[j];
                    if (farm.Definition.Id != BuildingId.Farm) continue;
                    if (farm.Rect.Center.DistanceTo(mill.Rect.Center) > radius) continue;
                    farm.WorkerBonus = Mathf.Max(farm.WorkerBonus, 1.5f);
                }
            }
        }

        /// <summary>Total housing across a team's finished buildings.</summary>
        public int HousingCapacity(Team team)
        {
            int total = Balance.Population.BaseHousing;
            for (int i = 0; i < _registry.All.Count; i++)
            {
                var b = _registry.All[i];
                if (b == null || b.Team != team || !b.IsOperational) continue;
                total += b.Definition.HousingCapacity;
            }
            return total;
        }

        public float PopularityAuraTotal(Team team)
        {
            float total = 0f;
            for (int i = 0; i < _registry.All.Count; i++)
            {
                var b = _registry.All[i];
                if (b == null || b.Team != team || !b.IsOperational) continue;
                total += b.Definition.PopularityAura;
            }
            return total;
        }

        public void Clear()
        {
            _registry.Clear();
            _grid.MarkDirty();
            _nav.Invalidate();
        }
    }
}
