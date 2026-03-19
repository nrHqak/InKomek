from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.models import NavigationRequest, NavigationResponse
from app.services.navigation_service import NavigationService

router = APIRouter()


def get_navigation_service() -> NavigationService:
    from app.main import get_navigation_service_instance

    service = get_navigation_service_instance()
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Navigation service not initialized. Ensure models are trained and server restarted.",
        )
    return service


@router.post("/navigate", response_model=NavigationResponse)
def navigate(
    payload: NavigationRequest,
    service: NavigationService = Depends(get_navigation_service),
) -> NavigationResponse:
    try:
        response = service.navigate(
            user_type=payload.user_type,
            start_coords=payload.start_coords,
            end_coords=payload.end_coords,
        )
        return NavigationResponse.model_validate(response)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to compute accessible route: {exc}",
        ) from exc
