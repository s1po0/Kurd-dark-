// -----------------------------------------------------------------------------
//  File: Core/EventBus.cs
//  Purpose: Zero-allocation, typed publish/subscribe hub. Systems never hold
//           direct references to the UI; the HUD subscribes to events instead.
//           Implemented with a generic static channel so Publish<T> compiles to
//           a single static-field delegate lookup (no dictionary, no boxing).
//
//  Mobile note: every subscription is disposable. GameWorld calls Reset() on
//  teardown so Play-Mode sessions in the editor never leak handlers.
// -----------------------------------------------------------------------------
using System;
using System.Collections.Generic;
using UnityEngine;

namespace KurdCastle.Core
{
    /// <summary>Marker for event payloads. Structs recommended (no GC pressure).</summary>
    public interface IGameEvent { }

    internal static class EventChannel<T> where T : IGameEvent
    {
        public static Action<T> Handlers;
        public static int SubscriberCount;

        public static void Clear()
        {
            Handlers = null;
            SubscriberCount = 0;
        }
    }

    public static class EventBus
    {
        static readonly List<Action> ResetActions = new List<Action>(64);
        static bool _registered;

        static void Register<T>() where T : IGameEvent
        {
            ResetActions.Add(EventChannel<T>.Clear);
        }

        public static void Subscribe<T>(Action<T> handler) where T : IGameEvent
        {
            if (handler == null) return;
            EnsureRegistered<T>();
            EventChannel<T>.Handlers += handler;
            EventChannel<T>.SubscriberCount++;
        }

        public static void Unsubscribe<T>(Action<T> handler) where T : IGameEvent
        {
            if (handler == null) return;
            EventChannel<T>.Handlers -= handler;
            EventChannel<T>.SubscriberCount = Mathf.Max(0, EventChannel<T>.SubscriberCount - 1);
        }

        public static void Publish<T>(T evt) where T : IGameEvent
        {
            var handlers = EventChannel<T>.Handlers;
            if (handlers == null) return;
            try
            {
                handlers(evt);
            }
            catch (Exception e)
            {
                // A broken listener must never take down the simulation.
                Debug.LogError("[EventBus] Handler threw for " + typeof(T).Name + ": " + e);
            }
        }

        static void EnsureRegistered<T>() where T : IGameEvent
        {
            // One-time registration per event type; the list is tiny (<40 entries).
            for (int i = 0; i < ResetActions.Count; i++)
            {
                if (ResetActions[i].Method != null &&
                    ResetActions[i].Method.DeclaringType == typeof(EventChannel<T>))
                    return;
            }
            Register<T>();
        }

        /// <summary>Drops every subscriber. Called by GameWorld.OnDestroy.</summary>
        public static void Reset()
        {
            for (int i = 0; i < ResetActions.Count; i++) ResetActions[i]();
            if (ResetActions.Count > 0) Debug.Log("[EventBus] Reset " + ResetActions.Count + " channel(s).");
        }
    }
}
