<script lang="ts">
    import { doAutocomplete } from '../DateTime/DateAbbreviations';
    import { parseTypedDateForDisplayUsingFutureDate } from '../DateTime/DateTools';
    import { labelContentWithAccessKey } from './EditTaskHelpers';

    export let id: 'notify' | 'start' | 'scheduled' | 'due' | 'done' | 'created' | 'cancelled';
    export let dateSymbol: string;
    export let date: string;
    export let isDateValid: boolean;
    export let forwardOnly: boolean;
    export let accesskey: string | null;

    // Use this for testing purposes only
    export let parsedDate: string = '';

    let pickedDate = '';

    $: {
        date = doAutocomplete(date);

        // Try to parse the date directly first (preserving time)
        let moment = window.moment(date, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD']);

        // If direct parsing fails, use the existing parser
        if (!moment.isValid()) {
            parsedDate = parseTypedDateForDisplayUsingFutureDate(id, date, forwardOnly);
            isDateValid = !parsedDate.includes('invalid');
            if (isDateValid) {
                moment = window.moment(parsedDate);
            }
        } else {
            isDateValid = true;
            parsedDate = moment.format('YYYY-MM-DD HH:mm');
        }

        // Convert to datetime-local format for the input
        if (isDateValid && moment.isValid()) {
            pickedDate = moment.format('YYYY-MM-DDTHH:mm');
        }
    }

    function onDatePicked(e: Event) {
        if (e.target === null) {
            return;
        }
        const target = e.target as HTMLInputElement;
        const datetimeValue = target.value;

        if (datetimeValue) {
            // Convert datetime-local format back to date string
            const moment = window.moment(datetimeValue);
            if (moment.isValid()) {
                // Format as date with time if time is not midnight
                if (moment.hour() !== 0 || moment.minute() !== 0) {
                    date = moment.format('YYYY-MM-DD HH:mm');
                } else {
                    date = moment.format('YYYY-MM-DD');
                }
            }
        }
    }

    // 'weekend' abbreviation omitted due to lack of space.
    const datePlaceholder = "Try 'Mon' or 'tm' then space";

    // Calculate minimum datetime (current time)
    $: minDateTime = window.moment().format('YYYY-MM-DDTHH:mm');
</script>

<label for={id}>{@html labelContentWithAccessKey(id, accesskey)}</label>
<!-- svelte-ignore a11y-accesskey -->
<input
    bind:value={date}
    {id}
    type="text"
    class:tasks-modal-error={!isDateValid}
    class="tasks-modal-date-input"
    placeholder={datePlaceholder}
    {accesskey}
/>

{#if isDateValid}
    <div class="tasks-modal-parsed-date">
        {dateSymbol}<input
            class="tasks-modal-date-editor-picker"
            type="datetime-local"
            bind:value={pickedDate}
            min={minDateTime}
            id="datetime-editor-picker"
            on:input={onDatePicked}
            tabindex="-1"
        />
    </div>
{:else}
    <code class="tasks-modal-parsed-date">{dateSymbol} {@html parsedDate}</code>
{/if}

<style>
</style>
