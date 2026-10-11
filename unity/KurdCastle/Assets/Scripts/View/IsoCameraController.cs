// -----------------------------------------------------------------------------
//  File: View/IsoCameraController.cs
//  Purpose: Isometric RTS camera: orthographic, yaw 45°, pitch 48°, pan with
//           inertia, pinch zoom, two-finger twist to rotate, edge-drag panning,
//           smooth focus-on events and additive shake for impacts.
// -----------------------------------------------------------------------------
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.View
{
    public sealed class IsoCameraController : MonoBehaviour
    {
        public Camera Camera { get; private set; }

        Vector3 _target;                 // point on the ground the camera orbits
        float _yaw = Balance.Camera.YawDefault;
        float _pitch = Balance.Camera.PitchDefault;
        float _orthoSize = Balance.Camera.OrthoDefault;
        float _targetOrthoSize = Balance.Camera.OrthoDefault;

        Vector3 _panVelocity;
        Vector3 _focusPosition;
        bool _focusing;

        float _shakeMagnitude;
        float _shakeTimer;
        float _shakeDuration;

        float _minX, _minZ, _maxX, _maxZ;

        public float Yaw { get { return _yaw; } }
        public float Pitch { get { return _pitch; } }
        public float Zoom { get { return _orthoSize; } }
        public Vector3 TargetPoint { get { return _target; } }

        public void Initialise(Camera camera, float mapWidth, float mapHeight)
        {
            Camera = camera;
            Camera.orthographic = true;
            Camera.orthographicSize = _orthoSize;
            Camera.nearClipPlane = 0.3f;
            Camera.farClipPlane = 220f;
            Camera.clearFlags = CameraClearFlags.SolidColor;
            Camera.backgroundColor = new Color(0.09f, 0.12f, 0.16f);
            Camera.transform.rotation = Quaternion.Euler(_pitch, _yaw, 0f);

            _minX = -4f;
            _minZ = -4f;
            _maxX = mapWidth + 4f;
            _maxZ = mapHeight + 4f;

            _target = new Vector3(mapWidth * 0.5f, 0f, mapHeight * 0.5f);
            ApplyTransform();

            EventBus.Subscribe<CameraFocusEvent>(OnFocusRequested);
            EventBus.Subscribe<CameraShakeEvent>(OnShakeRequested);
        }

        void OnDestroy()
        {
            EventBus.Unsubscribe<CameraFocusEvent>(OnFocusRequested);
            EventBus.Unsubscribe<CameraShakeEvent>(OnShakeRequested);
        }

        void OnFocusRequested(CameraFocusEvent evt)
        {
            _focusPosition = new Vector3(evt.WorldPosition.x, 0f, evt.WorldPosition.z);
            _focusing = !evt.Instant;
            if (evt.Instant) { _target = _focusPosition; ApplyTransform(); }
        }

        void OnShakeRequested(CameraShakeEvent evt)
        {
            // Only shake for things the player can plausibly see.
            float distance = Vector3.Distance(_target, evt.WorldPosition);
            if (distance > 45f) return;
            float falloff = Mathf.Clamp01(1f - distance / 45f);
            _shakeMagnitude = Mathf.Max(_shakeMagnitude, evt.Magnitude * falloff);
            _shakeDuration = evt.Duration;
            _shakeTimer = evt.Duration;
        }

        // =====================================================================
        //  Control API (called by the player controller / UI)
        // =====================================================================
        public void PanBy(Vector2 screenDelta)
        {
            // Screen-space drag → world-space pan, scaled by zoom so the gesture
            // feels identical at every zoom level.
            float scale = _orthoSize * 2f / Mathf.Max(1f, Screen.height) * 1.35f;
            Vector3 forward = Quaternion.Euler(0f, _yaw, 0f) * Vector3.forward;
            Vector3 right = Quaternion.Euler(0f, _yaw, 0f) * Vector3.right;
            Vector3 move = (-right * screenDelta.x + -forward * screenDelta.y) * scale;
            move.y = 0f;

            _panVelocity = move / Mathf.Max(0.0001f, Time.unscaledDeltaTime);
            _target += move;
            ClampTarget();
            ApplyTransform();
        }

        public void AddPanInertia()
        {
            // Called when the finger lifts: keep drifting briefly.
            _target += _panVelocity * 0.08f;
            ClampTarget();
            ApplyTransform();
            _panVelocity *= 0.35f;
        }

        public void ZoomBy(float delta)
        {
            _targetOrthoSize = Mathf.Clamp(_targetOrthoSize - delta * 6f,
                                           Balance.Camera.OrthoMin, Balance.Camera.OrthoMax);
        }

        public void SetZoom(float value)
        {
            _targetOrthoSize = Mathf.Clamp(value, Balance.Camera.OrthoMin, Balance.Camera.OrthoMax);
        }

        public void RotateBy(float degrees)
        {
            _yaw += degrees * Balance.Camera.RotateSensitivity;
            ApplyTransform();
        }

        public void EdgePan(Vector2 screenPosition)
        {
            float margin = Balance.Camera.EdgeDragMarginPixels;
            Vector2 dir = Vector2.zero;
            if (screenPosition.x < margin) dir.x = -1f;
            else if (screenPosition.x > Screen.width - margin) dir.x = 1f;
            if (screenPosition.y < margin) dir.y = -1f;
            else if (screenPosition.y > Screen.height - margin) dir.y = 1f;
            if (dir == Vector2.zero) return;

            Vector3 forward = Quaternion.Euler(0f, _yaw, 0f) * Vector3.forward;
            Vector3 right = Quaternion.Euler(0f, _yaw, 0f) * Vector3.right;
            float speed = Balance.Camera.EdgeDragSpeed * (0.5f + _orthoSize / Balance.Camera.OrthoMax);
            Vector3 move = (right * dir.x + forward * dir.y) * speed * Time.unscaledDeltaTime;
            move.y = 0f;
            _target += move;
            ClampTarget();
            ApplyTransform();
        }

        public void Focus(Vector3 worldPosition, bool instant = false)
        {
            _focusPosition = new Vector3(worldPosition.x, 0f, worldPosition.z);
            _focusing = !instant;
            if (instant)
            {
                _target = _focusPosition;
                ApplyTransform();
            }
        }

        public void Tick(float dt)
        {
            if (_focusing)
            {
                _target = Vector3.Lerp(_target, _focusPosition, Mathf.Clamp01(dt * Balance.Camera.FocusLerp));
                if ((_target - _focusPosition).sqrMagnitude < 0.0025f) _focusing = false;
                ClampTarget();
            }

            if (Mathf.Abs(_orthoSize - _targetOrthoSize) > 0.01f)
            {
                _orthoSize = Mathf.Lerp(_orthoSize, _targetOrthoSize,
                                        Mathf.Clamp01(dt * Balance.Camera.ZoomLerp));
                if (Camera != null) Camera.orthographicSize = _orthoSize;
            }

            if (_shakeTimer > 0f)
            {
                _shakeTimer -= dt;
                float k = _shakeDuration > 0f ? _shakeTimer / _shakeDuration : 0f;
                Vector2 offset = UnityEngine.Random.insideUnitCircle * _shakeMagnitude * k;
                ApplyTransform(new Vector3(offset.x, 0f, offset.y));
                if (_shakeTimer <= 0f) { _shakeMagnitude = 0f; ApplyTransform(); }
            }
        }

        void ClampTarget()
        {
            _target.x = Mathf.Clamp(_target.x, _minX, _maxX);
            _target.z = Mathf.Clamp(_target.z, _minZ, _maxZ);
            _target.y = 0f;
        }

        void ApplyTransform(Vector3 extraOffset = default)
        {
            if (Camera == null) return;
            Quaternion rotation = Quaternion.Euler(_pitch, _yaw, 0f);
            Vector3 direction = rotation * Vector3.forward;
            Vector3 position = _target + extraOffset - direction * Balance.Camera.CameraHeight;
            Camera.transform.SetPositionAndRotation(position, rotation);
            Camera.orthographicSize = _orthoSize;
        }

        /// <summary>Ground-plane hit test without colliders or physics queries.</summary>
        public bool ScreenToGround(Vector2 screenPosition, out Vector3 world)
        {
            world = Vector3.zero;
            if (Camera == null) return false;
            Ray ray = Camera.ScreenPointToRay(screenPosition);
            float denom = ray.direction.y;
            if (Mathf.Abs(denom) < 0.0001f) return false;
            float t = -ray.origin.y / denom;
            if (t < 0f) return false;
            world = ray.origin + ray.direction * t;
            return true;
        }

        public Vector2Int ScreenToCell(Vector2 screenPosition)
        {
            Vector3 world;
            if (!ScreenToGround(screenPosition, out world)) return new Vector2Int(-1, -1);
            return new Vector2Int(Mathf.FloorToInt(world.x), Mathf.FloorToInt(world.z));
        }
    }
}
