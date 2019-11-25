import { AsyncActionSequence, IAsyncAction } from "actions/async";
import { getWeb3Provider } from "arc";
//import axios from "axios";

import Box = require("3box");
import { NotificationStatus, showNotification } from "reducers/notifications";
import { ActionTypes, newProfile } from "reducers/profilesReducer";

// Load account profile data from our database for all the "members" of the DAO
// TODO: use this once 3box fixes getProfiles
export function getProfilesForAddresses(addresses: string[]) {
  return async (dispatch: any) => {
    try {
      const results = await Box.getProfiles(addresses);
      dispatch({
        type: ActionTypes.GET_PROFILE_DATA,
        sequence: AsyncActionSequence.Success,
        payload: { profiles: results.data },
      });
    } catch (e) {
      dispatch({
        type: ActionTypes.GET_PROFILE_DATA,
        sequence: AsyncActionSequence.Failure,
        payload: e.toString(),
      });
    }
  };
}

export function getProfile(accountAddress: string) {
  return async (dispatch: any) => {
    try {
      // Get profile data for this account
      const profile: any = await Box.getProfile(accountAddress);

      if (profile) {
        profile.ethereumAccountAddress = accountAddress;
        profile.socialURLs = await Box.getVerifiedAccounts(profile);
        dispatch({
          type: ActionTypes.GET_PROFILE_DATA,
          sequence: AsyncActionSequence.Success,
          payload: { profiles: { [accountAddress]: profile } },
        });
      } else {
        // Setup blank profile for the account
        dispatch({
          type: ActionTypes.GET_PROFILE_DATA,
          sequence: AsyncActionSequence.Success,
          payload: { profiles: { [accountAddress]: newProfile(accountAddress) } },
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Error getting profile from 3box (${e.message})`);
      dispatch({
        type: ActionTypes.GET_PROFILE_DATA,
        sequence: AsyncActionSequence.Failure,
        payload: e.toString(),
      });
    }
  };
}

export type UpdateProfileAction = IAsyncAction<"UPDATE_PROFILE", { accountAddress: string }, { description: string; name: string; socialURLs?: any }>;

export function updateProfile(accountAddress: string, name: string, description: string) {
  return async (dispatch: any, _getState: any) => {
    dispatch({
      type: ActionTypes.UPDATE_PROFILE,
      sequence: AsyncActionSequence.Pending,
      meta: { accountAddress },
    } as UpdateProfileAction);

    const state = _getState();
    let box;

    try {
      if (state.threeBox) {
        box = state.threeBox;
      } else {
        const web3Provider = await getWeb3Provider();
        box = await Box.openBox(accountAddress, web3Provider);
      }
      await box.syncDone;
      await box.public.setMultiple(["name", "description"], [name, description]);
    } catch (e) {
      const errorMsg = e.response && e.response.data ? e.response.data.error.message : e.toString();
      // eslint-disable-next-line no-console
      console.error("Error saving profile to 3box: ", errorMsg);

      dispatch({
        type: ActionTypes.UPDATE_PROFILE,
        sequence: AsyncActionSequence.Failure,
        meta: { accountAddress },
      } as UpdateProfileAction);

      dispatch(showNotification(NotificationStatus.Failure, `Saving profile to 3box failed: ${errorMsg}`));
      return false;
    }

    dispatch({
      type: ActionTypes.UPDATE_PROFILE,
      sequence: AsyncActionSequence.Success,
      meta: { accountAddress },
      payload: { name, description, threeBox: box },
    } as UpdateProfileAction);

    dispatch(showNotification(NotificationStatus.Success, "Profile data saved to 3box"));
    return true;
  };
}

